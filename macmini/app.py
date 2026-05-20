import asyncio
import json
import logging
import os
import shutil
import subprocess
import time
import urllib.request
import httpx
from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from config import settings

if settings.model_cache_dir:
    os.environ["HF_HOME"] = settings.model_cache_dir
    os.environ["TRANSFORMERS_CACHE"] = settings.model_cache_dir

import clip_service
import flux_service
import sdxl_service
import whisper_service

logger = logging.getLogger("gateway")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s %(message)s")

app = FastAPI(title="Mac Mini Gateway", version="2.0.0")

_chat_sem = asyncio.Semaphore(settings.max_chat_concurrency)
_embed_sem = asyncio.Semaphore(settings.max_embed_concurrency)
_clip_sem = asyncio.Semaphore(settings.max_clip_concurrency)
_whisper_sem = asyncio.Semaphore(settings.max_whisper_concurrency)
_flux_sem = asyncio.Semaphore(settings.max_flux_concurrency)

_ollama_client: httpx.AsyncClient | None = None

async def _get_ollama_client() -> httpx.AsyncClient:
    global _ollama_client
    if _ollama_client is None or _ollama_client.is_closed:
        _ollama_client = httpx.AsyncClient(
            base_url=settings.base_url,
            timeout=httpx.Timeout(settings.timeout, connect=10.0))
    return _ollama_client

ALLOWED = set(settings.allowed_models)

def _check_model(model: str):
    if ALLOWED and model not in ALLOWED:
        raise HTTPException(400, f"Model '{model}' not in allowed list")

async def _ollama_embedding(client: httpx.AsyncClient, model: str, text: str) -> list[float]:

    try:
        resp = await client.post(
            "/api/embed",
            json={"model": model, "input": text},
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("embeddings", [[]])[0]
    except httpx.HTTPStatusError as e:
        logger.warning(
            "Ollama /api/embed failed: model=%s, status=%s, body=%r",
            model,
            e.response.status_code,
            e.response.text[:500])
        if e.response.status_code != 404:
            raise HTTPException(
                status_code=502,
                detail=f"Ollama /api/embed failed: {e.response.status_code} {e.response.text[:300]}")

    try:
        resp = await client.post(
            "/api/embeddings",
            json={"model": model, "prompt": text},
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("embedding", [])
    except httpx.HTTPStatusError as e:
        logger.warning(
            "Ollama /api/embeddings failed: model=%s, status=%s, body=%r",
            model,
            e.response.status_code,
            e.response.text[:500])
        raise HTTPException(
            status_code=502,
            detail=f"Ollama /api/embeddings failed: {e.response.status_code} {e.response.text[:300]}")

def _preflight_wireguard():

    bind = settings.bind_host
    if bind in ("0.0.0.0", "127.0.0.1", "localhost"):
        return

    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.bind((bind, 0))
        s.close()
        logger.info(f"WireGuard tunnel UP ({bind})")
    except OSError:
        logger.warning(f"WireGuard tunnel DOWN — {bind} not available. Start it first: sudo wg-quick up <config>")

def _preflight_ollama():

    url = f"{settings.base_url}api/tags"

    def _is_reachable():
        try:
            with urllib.request.urlopen(url, timeout=5):
                return True
        except Exception:
            return False

    if _is_reachable():
        logger.info(f"Ollama reachable at {settings.base_url}")
        return

    if not shutil.which("ollama"):
        logger.info("Ollama not found — installing via brew...")
        try:
            subprocess.run(["brew", "install", "ollama"], check=True, timeout=120)
            logger.info("Ollama installed")
        except Exception as e:
            logger.warning(f"Failed to install Ollama: {e}")
            return

    logger.info("Starting Ollama...")
    try:
        subprocess.Popen(
            ["ollama", "serve"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL)

        import time
        for _ in range(12):
            time.sleep(5)
            if _is_reachable():
                logger.info(f"Ollama started and reachable at {settings.base_url}")
                return
        logger.warning(f"Ollama started but not reachable at {settings.base_url} after 60s")
    except Exception as e:
        logger.warning(f"Failed to start Ollama: {e}")


def _preflight_ollama_embedding_models():

    required_models = [
        model
        for model in settings.allowed_models
        if any(token in model.lower() for token in ("embed", "bge", "mxbai"))
    ]
    if not required_models:
        return

    try:
        with urllib.request.urlopen(f"{settings.base_url}api/tags", timeout=10) as resp:
            data = json.loads(resp.read().decode())
        installed = {model.get("name", "") for model in data.get("models", [])}
    except Exception as e:
        logger.warning(f"Could not list Ollama models before embedding preflight: {e}")
        return

    for model in required_models:
        if model in installed:
            logger.info(f"Ollama embedding model already available: {model}")
            continue

        logger.info(f"Pulling Ollama embedding model: {model}")
        try:
            subprocess.run(["ollama", "pull", model], check=True, timeout=1800)
            logger.info(f"Ollama embedding model ready: {model}")
        except Exception as e:
            logger.warning(f"Failed to pull Ollama embedding model {model}: {e}")


def _preflight_models():

    errors = []

    _preflight_ollama_embedding_models()

    try:
        clip_service.ensure_downloaded()
    except Exception as e:
        logger.warning(f"SigLIP download failed: {e}")
        errors.append(("SigLIP", str(e)))

    try:
        whisper_service.ensure_downloaded()
    except Exception as e:
        logger.warning(f"Whisper download failed: {e}")
        errors.append(("Whisper", str(e)))

    if settings.sdxl_model:
        try:
            sdxl_service.ensure_downloaded(settings.sdxl_model)
        except Exception as e:
            logger.warning(f"SDXL download failed: {e}")
            errors.append(("SDXL", str(e)))

    if settings.flux_model:
        try:
            flux_service.ensure_downloaded(settings.flux_model)
        except Exception as e:
            logger.warning(f"FLUX download failed: {e}")
            errors.append(("FLUX", str(e)))

    if errors:
        logger.warning(f"Model download issues: {errors}")
    else:
        logger.info("All models cached and ready")

@app.get("/health")
async def health():
    return {
        "ok": True,
        "ollama": settings.base_url,
        "clip_available": clip_service.is_available(),
        "whisper_available": whisper_service.is_available(),
        "sdxl_available": sdxl_service.is_available(settings.sdxl_model) if settings.sdxl_model else False,
        "flux_available": flux_service.is_available(settings.flux_model) if settings.flux_model else False,
        "max_chat_concurrency": settings.max_chat_concurrency,
        "max_embed_concurrency": settings.max_embed_concurrency,
        "max_clip_concurrency": settings.max_clip_concurrency,
        "max_whisper_concurrency": settings.max_whisper_concurrency,
        "max_flux_concurrency": settings.max_flux_concurrency}

@app.get("/models")
async def list_models():

    client = await _get_ollama_client()
    resp = await client.get("/api/tags")
    resp.raise_for_status()
    data = resp.json()

    models = []

    for m in data.get("models", []):
        name = m.get("name", "") if isinstance(m, dict) else str(m)
        if not ALLOWED or name in ALLOWED:
            models.append({"id": name, "object": "model"})

    return {"object": "list", "data": models}

@app.post("/chat/completions")
async def chat_completions(request: Request):

    body = await request.json()
    model = body.get("model", "")
    _check_model(model)
    stream = body.get("stream", False)

    ollama_body = {
        "model": model,
        "messages": body.get("messages", []),
        "stream": stream,
        "options": {}}

    if "temperature" in body:
        ollama_body["options"]["temperature"] = body["temperature"]
    if "max_tokens" in body:
        ollama_body["options"]["num_predict"] = body["max_tokens"]
    if body.get("response_format", {}).get("type") == "json_object":
        ollama_body["format"] = "json"

    client = await _get_ollama_client()

    if stream:

        async def _stream():

            async with _chat_sem:

                async with client.stream("POST", "/api/chat", json=ollama_body) as resp:

                    resp.raise_for_status()

                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        chunk = json.loads(line)
                        content = chunk.get("message", {}).get("content", "")
                        done = chunk.get("done", False)
                        oai_chunk = {
                            "choices": [{
                                "delta": {"content": content} if content else {},
                                "finish_reason": "stop" if done else None,
                                "index": 0,
                            }],
                        }
                        yield f"data: {json.dumps(oai_chunk)}\n\n"
                    yield "data: [DONE]\n\n"

        return StreamingResponse(_stream(), media_type="text/event-stream")

    async with _chat_sem:

        resp = await client.post("/api/chat", json=ollama_body)
        resp.raise_for_status()
        data = resp.json()

    content = data.get("message", {}).get("content", "")
    return {
        "choices": [{
            "message": {"role": "assistant", "content": content},
            "finish_reason": "stop",
            "index": 0,
        }],
        "model": model,
        "usage": {
            "prompt_tokens": data.get("prompt_eval_count", 0),
            "completion_tokens": data.get("eval_count", 0),
            "total_tokens": data.get("prompt_eval_count", 0) + data.get("eval_count", 0),
        },
    }

@app.post("/embeddings")
async def embeddings(request: Request):

    body = await request.json()
    model = body.get("model", "")
    _check_model(model)
    input_text = body.get("input", "")

    if isinstance(input_text, str):
        texts = [input_text]
    else:
        texts = input_text

    async with _embed_sem:
        client = await _get_ollama_client()
        results = []
        for i, text in enumerate(texts):
            try:
                embedding = await _ollama_embedding(client, model, text)
            except HTTPException:
                logger.warning(
                    "Gateway embedding request failed: model=%s, index=%s, input_chars=%s",
                    model,
                    i,
                    len(text or ""))
                raise
            results.append({
                "object": "embedding",
                "embedding": embedding,
                "index": i,
            })

    return {
        "object": "list",
        "data": results,
        "model": model}

@app.post("/classify-image")
async def classify_image(image: UploadFile = File(...)):

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(400, "Empty image file")

    async with _clip_sem:
        start = time.time()
        result = await asyncio.get_event_loop().run_in_executor(
            None, clip_service.classify, image_bytes)
        logger.info(
            "Gateway image classification completed: bytes=%s, elapsed=%.2fs, category=%s",
            len(image_bytes),
            time.time() - start,
            result.get("category"))

    return result

@app.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(400, "Empty audio file")

    async with _whisper_sem:
        result = await asyncio.get_event_loop().run_in_executor(
            None, whisper_service.transcribe, audio_bytes)

    if not result.get("success"):
        raise HTTPException(500, result.get("error", "Transcription failed"))

    return result

class GenerateImageRequest(BaseModel):

    prompt: str = Field(..., min_length=1, max_length=2000)
    width: int = Field(default=512, ge=256, le=1024)
    height: int = Field(default=512, ge=256, le=1024)
    num_inference_steps: int = Field(default=4, ge=1, le=50)
    guidance_scale: float = Field(default=0.0, ge=0.0, le=20.0)
    seed: int | None = Field(default=None)

@app.post("/generate-image")
async def generate_image(req: GenerateImageRequest):

    async with _flux_sem:

        result = await asyncio.get_event_loop().run_in_executor(
            None,
            sdxl_service.generate,
            settings.sdxl_model,
            req.prompt,
            req.width,
            req.height,
            req.num_inference_steps,
            req.guidance_scale,
            req.seed)

    return result

class GenerateImageFluxRequest(BaseModel):

    prompt: str = Field(..., min_length=1, max_length=2000)
    width: int = Field(default=1024, ge=256, le=2048)
    height: int = Field(default=1024, ge=256, le=2048)
    num_inference_steps: int = Field(default=4, ge=1, le=50)
    guidance_scale: float = Field(default=0.0, ge=0.0, le=20.0)
    seed: int | None = Field(default=None)

@app.post("/generate-image-flux")
async def generate_image_flux(req: GenerateImageFluxRequest):

    if not settings.flux_model:
        raise HTTPException(400, "FLUX_MODEL not configured")

    async with _flux_sem:

        result = await asyncio.get_event_loop().run_in_executor(
            None,
            flux_service.generate,
            settings.flux_model,
            req.prompt,
            req.width,
            req.height,
            req.num_inference_steps,
            req.guidance_scale,
            req.seed)

    return result

class DownloadModelRequest(BaseModel):
    model_id: str = Field(..., min_length=1)

@app.post("/download-model")
async def download_model(req: DownloadModelRequest):

    def _download():
        from huggingface_hub import snapshot_download
        cache_dir = os.path.join(os.environ["HF_HOME"], "hub")
        token = settings.hf_token or None
        return snapshot_download(
            req.model_id,
            cache_dir=cache_dir,
            token=token)

    try:
        path = await asyncio.get_event_loop().run_in_executor(None, _download)
        return {"ok": True, "model_id": req.model_id, "path": str(path)}
    except Exception as e:
        raise HTTPException(500, f"Download failed: {e}")

@app.on_event("startup")
async def startup():

    logger.info(f"Gateway ready on {settings.bind_host}:{settings.port}")
    logger.info(f"Ollama backend: {settings.base_url}")
    logger.info(f"Allowed models: {settings.allowed_models}")
    logger.info(
        f"Concurrency: chat={settings.max_chat_concurrency}, "
        f"embed={settings.max_embed_concurrency}, "
        f"clip={settings.max_clip_concurrency}, "
        f"whisper={settings.max_whisper_concurrency}, "
        f"flux={settings.max_flux_concurrency}")

@app.on_event("shutdown")
async def shutdown():
    global _ollama_client
    if _ollama_client and not _ollama_client.is_closed:
        await _ollama_client.aclose()
        _ollama_client = None
    logger.info("Gateway shut down")

if __name__ == "__main__":

    import uvicorn

    print("=" * 60)
    print("Mac Mini Gateway — One-Click Start")
    print("=" * 60)

    # Step 1: WireGuard
    print("\n[1/4] Checking WireGuard...")
    _preflight_wireguard()

    # Step 2: Ollama
    print("\n[2/4] Checking Ollama...")
    _preflight_ollama()

    # Step 3: Models
    print("\n[3/4] Pre-downloading models...")
    _preflight_models()

    # Step 4: Start
    print(f"\n[4/4] Starting gateway on {settings.bind_host}:{settings.port}")
    print("=" * 60)

    uvicorn.run(
        "app:app",
        host=settings.bind_host,
        port=settings.port,
        log_level="info")

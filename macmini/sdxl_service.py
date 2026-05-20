import base64
import io
import logging
import os
import time
import torch
from diffusers import StableDiffusionPipeline
from PIL import Image

logger = logging.getLogger(__name__)

_pipe = None
_device = None
_model_id = None

def _resolve_device():
    global _device
    if _device is not None:
        return _device

    if torch.backends.mps.is_available():
        _device = "mps"
    elif torch.cuda.is_available():
        _device = "cuda"
    else:
        _device = "cpu"

    logger.info(f"SD Turbo device: {_device}")
    return _device

def _load(model_id: str):
    global _pipe, _model_id

    if _pipe is not None and _model_id == model_id:
        return _pipe

    device = _resolve_device()
    dtype = torch.float16 if device in ("mps", "cuda") else torch.float32

    cache_key = "models--" + model_id.replace("/", "--")
    local_path = os.path.join(os.environ["HF_HOME"], "hub", cache_key)
    snapshots = os.path.join(local_path, "snapshots")
    if os.path.isdir(snapshots) and os.listdir(snapshots):
        snapshot_hash = os.listdir(snapshots)[0]
        local_path = os.path.join(snapshots, snapshot_hash)

    logger.info(f"Loading SD Turbo from {local_path} on {device} ({dtype})...")
    start = time.time()

    _pipe = StableDiffusionPipeline.from_pretrained(
        local_path, torch_dtype=dtype, variant="fp16", local_files_only=True)
    _pipe = _pipe.to(device)

    if device == "cuda":
        _pipe.enable_attention_slicing()

    elapsed = time.time() - start
    _model_id = model_id
    logger.info(f"SD Turbo loaded in {elapsed:.1f}s")
    return _pipe

def is_available(model_id: str) -> bool:
    cache_key = "models--" + model_id.replace("/", "--")
    cache_dir = os.path.join(os.environ["HF_HOME"], "hub", cache_key)
    snapshots = os.path.join(cache_dir, "snapshots")
    return os.path.isdir(snapshots) and bool(os.listdir(snapshots))

def ensure_downloaded(model_id: str):

    cache_key = "models--" + model_id.replace("/", "--")
    cache_dir = os.path.join(os.environ["HF_HOME"], "hub", cache_key)
    snapshots = os.path.join(cache_dir, "snapshots")
    if os.path.isdir(snapshots) and os.listdir(snapshots):
        logger.info(f"SD Turbo model already cached at {cache_dir}")
        return
    logger.info(f"Downloading SD Turbo: {model_id}...")
    from huggingface_hub import snapshot_download
    snapshot_download(
        model_id,
        cache_dir=os.path.join(os.environ["HF_HOME"], "hub"),
        ignore_patterns=["*.onnx", "*.onnx_data", "*.png", "*.jpg",
                         "*.msgpack", "*.bin", "*.xml",
                         "sd_turbo.safetensors"])
    logger.info("SD Turbo model ready")

def generate(
    model_id: str,
    prompt: str,
    width: int = 512,
    height: int = 512,
    num_inference_steps: int = 4,
    guidance_scale: float = 0.0,
    seed: int | None = None) -> dict:

    pipe = _load(model_id)
    device = _resolve_device()

    generator = None
    if seed is not None:
        generator = torch.Generator(device=device).manual_seed(seed)

    start = time.time()

    result = pipe(
        prompt=prompt,
        width=width,
        height=height,
        num_inference_steps=num_inference_steps,
        guidance_scale=guidance_scale,
        generator=generator)

    elapsed = time.time() - start
    image: Image.Image = result.images[0]

    buf = io.BytesIO()
    image.save(buf, format="PNG")
    image_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    logger.info(
        f"Generated {width}x{height} image in {elapsed:.1f}s "
        f"(steps={num_inference_steps})")

    return {
        "image_base64": image_b64,
        "width": width,
        "height": height,
        "elapsed_seconds": round(elapsed, 2)}

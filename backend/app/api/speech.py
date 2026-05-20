import tempfile
import os
import logging
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
import psutil
import subprocess
from typing import List

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/speech", tags=["Speech"])

MODEL_RAM_GB = {
    "tiny": 0.5,
    "base": 1.0,
    "small": 2.0,
    "medium": 6.0,
    "large": 16.0,
}

def _get_system_ram_gb() -> float:
    vm = psutil.virtual_memory()
    return vm.available / (1024 ** 3)

def _get_gpus_info() -> List[dict]:
    try:
        out = subprocess.check_output(["nvidia-smi", "--query-gpu=memory.total,memory.free,name", "--format=csv,noheader,nounits"])
        lines = out.decode().splitlines()
        gpus = []
        for line in lines:
            parts = [p.strip() for p in line.split(",")]
            if len(parts) >= 3:
                total, free, name = parts[0], parts[1], parts[2]
                gpus.append({"name": name, "total_gb": float(total) / 1024.0, "free_gb": float(free) / 1024.0})
        return gpus
    except Exception:
        return []

@router.get("/capabilities")
async def speech_capabilities():

    system_ram = _get_system_ram_gb()
    gpus = _get_gpus_info()

    available_models = {}
    for m, req in MODEL_RAM_GB.items():
        supported = system_ram >= req or any((g.get("free_gb", 0) >= req) for g in gpus)
        available_models[m] = {"required_gb": req, "supported": supported}

    return {
        "system_ram_gb": system_ram,
        "gpus": gpus,
        "models": available_models
    }

@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str = Form("auto"),
    model: str = Form("small"),
):
   
    suffix = os.path.splitext(file.filename or "")[1] or ".webm"
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            contents = await file.read()
            tmp.write(contents)
            tmp_path = tmp.name
    except Exception as exc:
        logger.exception("Failed to save uploaded audio")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to process uploaded audio")

    try:
        import whisper
    except Exception as exc:
        logger.warning("Whisper not available: %s", exc)
        os.unlink(tmp_path)
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Local Whisper is not installed on the server")

    try:
        model_obj = whisper.load_model(model)
    except Exception as exc:
        logger.exception("Failed to load whisper model %s", model)
        os.unlink(tmp_path)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Could not load model: {model}")

    try:
        options = {}
        if language and language != "auto":
            options["language"] = language

        result = model_obj.transcribe(tmp_path, **options)
        text = (result.get("text") or "").strip()
        detected_lang = result.get("language") if isinstance(result, dict) else None
    except Exception as exc:
        logger.exception("Whisper transcription failed")
        os.unlink(tmp_path)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Transcription failed")
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass

    return {"text": text, "language": detected_lang}

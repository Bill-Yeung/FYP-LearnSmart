import logging
import os
import tempfile
import mlx_whisper

logger = logging.getLogger(__name__)

_WHISPER_MODEL = "mlx-community/whisper-large-v3-turbo"

def is_available() -> bool:
    return True

_CACHE_KEY = "models--" + _WHISPER_MODEL.replace("/", "--")
_local_model_path = None

def _resolve_local_path() -> str:
    global _local_model_path
    if _local_model_path:
        return _local_model_path
    cache_dir = os.path.join(os.environ["HF_HOME"], "hub", _CACHE_KEY)
    snapshots = os.path.join(cache_dir, "snapshots")
    if os.path.isdir(snapshots) and os.listdir(snapshots):
        _local_model_path = os.path.join(snapshots, os.listdir(snapshots)[0])
        return _local_model_path
    return _WHISPER_MODEL

def ensure_downloaded():

    cache_dir = os.path.join(os.environ["HF_HOME"], "hub", _CACHE_KEY)
    snapshots = os.path.join(cache_dir, "snapshots")
    if os.path.isdir(snapshots) and os.listdir(snapshots):
        logger.info(f"mlx-whisper model already cached at {cache_dir}")
        return
    logger.info(f"Downloading mlx-whisper model: {_WHISPER_MODEL}...")
    from huggingface_hub import snapshot_download
    snapshot_download(_WHISPER_MODEL, cache_dir=os.path.join(os.environ["HF_HOME"], "hub"))
    logger.info("mlx-whisper model ready")

def transcribe(audio_bytes: bytes) -> dict:

    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(suffix=".bin", delete=False) as tmp:
            tmp.write(audio_bytes)
            temp_path = tmp.name

        result = mlx_whisper.transcribe(
            temp_path,
            path_or_hf_repo=_resolve_local_path())

        return {
            "success": True,
            "text": result["text"],
            "language": result.get("language", "")}

    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        return {
            "success": False,
            "text": "",
            "language": "",
            "error": str(e)}

    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)

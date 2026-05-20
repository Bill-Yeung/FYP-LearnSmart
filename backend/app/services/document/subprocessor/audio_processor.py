import logging
import tempfile
import os
import whisper
import httpx

from app.services.document.extraction_tree import ProcessorResult
from app.core.config import settings

logger = logging.getLogger(__name__)

class AudioProcessor:

    def __init__(self, model_name: str = "base", device: str = "cpu"):

        self.model_name = model_name
        self.device = device
        self._model = None

    @property
    def model(self):

        if self._model is None:
            logger.info(f"Loading Whisper model: {self.model_name}")
            self._model = whisper.load_model(self.model_name, device = self.device)
            logger.info("Whisper model loaded")

        return self._model

    def process(self, source: str | bytes) -> ProcessorResult:

        audio_bytes = source if isinstance(source, bytes) else None
        if audio_bytes is None and isinstance(source, str) and os.path.isfile(source):
            try:
                with open(source, "rb") as f:
                    audio_bytes = f.read()
            except Exception:
                pass

        macmini_url = settings.macmini_base_url
        if macmini_url and audio_bytes is not None:
            try:
                with httpx.Client(timeout=120.0) as client:
                    resp = client.post(
                        f"{macmini_url}/transcribe",
                        files={"audio": ("audio.bin", audio_bytes, "application/octet-stream")})
                    if resp.status_code == 200:
                        data = resp.json()
                        if data.get("success"):
                            logger.info(f"Transcription via Mac Mini: {len(data['text'])} chars")
                            return ProcessorResult(
                                success=True,
                                output_text=data["text"],
                                language=data.get("language", ""))
            except Exception as e:
                logger.debug(f"Mac Mini Whisper unavailable: {e}")

        temp_path = None

        try:

            if isinstance(source, bytes):

                with tempfile.NamedTemporaryFile(suffix = ".bin", delete = False) as tmp:
                    tmp.write(source)
                    temp_path = tmp.name
                file_path = temp_path
                logger.info(f"Transcribing audio from bytes ({len(source)} bytes)")

            else:
                file_path = source
                logger.info(f"Transcribing audio: {file_path}")

            result = self.model.transcribe(file_path, verbose = False)
            logger.info(f"Transcription complete: {len(result['text'])} chars")

            return ProcessorResult(
                success = True,
                output_text = result['text'],
                language = result.get('language', ''))

        except Exception as e:

            logger.error(f"Audio processing failed: {e}")
            return ProcessorResult(success = False, error = str(e))

        finally:
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)

# Global instance
audio_processor = AudioProcessor()

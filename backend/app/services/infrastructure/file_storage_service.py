from typing import BinaryIO
from pathlib import Path
from uuid import uuid4
import hashlib
import aiofiles
import logging

from app.core.config import settings
from app.utils.document_utils import detect_document_type

logger = logging.getLogger(__name__)

class FileStorageService:

    def __init__(self, base_dir: str | Path | None = None):

        self.base_dir = Path(base_dir) if base_dir else Path(settings.upload_dir)
        self._ensure_base_dir()

    def _ensure_base_dir(self):

        self.base_dir.mkdir(parents = True, exist_ok = True)
        logger.info(f"File storage base directory: {self.base_dir.absolute()}")

    def calculate_checksum(self, content: bytes) -> str:
        return hashlib.sha256(content).hexdigest()

    async def save_file(
        self,
        file: BinaryIO,
        filename: str,
        subdirectory: str | None = None,
        file_id: str | None = None) -> dict:
       
        if file_id is None:
            file_id = str(uuid4())

        if subdirectory is None:
            doc_type = detect_document_type(filename)
            subdirectory = doc_type.value if doc_type else "other"

        content = file.read() if hasattr(file, 'read') else file
        checksum = self.calculate_checksum(content)

        target_dir = self.base_dir / subdirectory
        target_dir.mkdir(parents = True, exist_ok = True)
        ext = Path(filename).suffix
        safe_filename = f"{file_id}{ext}"
        file_path = target_dir / safe_filename

        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(content)

        logger.info(f"Saved file: {file_path} ({len(content)} bytes, type: {subdirectory})")

        return {
            "file_id": file_id,
            "file_path": str(file_path),
            "file_size": len(content),
            "checksum": checksum}

    async def save_text_file(
        self,
        content: str,
        filename: str,
        subdirectory: str = "text",
        file_id: str | None = None) -> dict:
        
        if file_id is None:
            file_id = Path(filename).stem

        content_bytes = content.encode('utf-8')
        checksum = self.calculate_checksum(content_bytes)

        target_dir = self.base_dir / subdirectory
        target_dir.mkdir(parents = True, exist_ok = True)
        ext = Path(filename).suffix or '.txt'
        safe_filename = f"{file_id}{ext}"
        file_path = target_dir / safe_filename

        async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
            await f.write(content)

        logger.info(f"Saved text file: {file_path} ({len(content_bytes)} bytes)")

        return {
            "file_id": file_id,
            "file_path": str(file_path),
            "file_size": len(content_bytes),
            "checksum": checksum}

    async def load_file(self, file_path: str) -> bytes:

        async with aiofiles.open(file_path, 'rb') as f:
            return await f.read()

    async def load_text(self, file_path: str) -> str:

        async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
            return await f.read()

    async def delete_file(self, file_path: str) -> bool:

        try:

            path = Path(file_path)
            if path.exists():
                path.unlink()
                logger.info(f"Deleted file: {file_path}")
                return True
            return False

        except Exception as e:
            logger.error(f"Failed to delete file {file_path}: {e}")
            return False

    async def delete_extracted_media(self, document_id: str) -> bool:

        import shutil

        try:
            extracted_dir = self.base_dir / "extracted" / document_id
            if extracted_dir.exists():
                shutil.rmtree(extracted_dir)
                logger.info(f"Deleted extracted media for document: {document_id}")
                return True
            return False

        except Exception as e:
            logger.error(f"Failed to delete extracted media for {document_id}: {e}")
            return False

    def file_exists(self, file_path: str) -> bool:
        return Path(file_path).exists()

    def get_file_size(self, file_path: str) -> int:
        return Path(file_path).stat().st_size if self.file_exists(file_path) else 0

# Global instance
file_storage_service = FileStorageService()

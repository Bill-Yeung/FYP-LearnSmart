import hashlib
import mimetypes
from pathlib import Path

from app.models.document import DocumentType

def calculate_checksum(content: bytes) -> str:

    return hashlib.sha256(content).hexdigest()

def detect_document_type(file_path: str) -> DocumentType | None:

    mime_type, _ = mimetypes.guess_type(file_path)

    if not mime_type:

        ext = Path(file_path).suffix.lower()

        match ext:
            case '.pdf':
                return DocumentType.pdf
            case '.mp4' | '.avi' | '.mov' | '.mkv' | '.webm':
                return DocumentType.video
            case '.mp3' | '.wav' | '.flac' | '.m4a' | '.ogg':
                return DocumentType.audio
            case '.doc' | '.docx':
                return DocumentType.word
            case '.xlsx' | '.xls':
                return DocumentType.excel
            case '.pptx' | '.ppt':
                return DocumentType.powerpoint
            case '.jpg' | '.jpeg' | '.png' | '.gif' | '.bmp' | '.tiff' | '.webp':
                return DocumentType.image
            case '.txt' | '.md' | '.csv' | '.json' | '.xml' | '.html' | '.htm' | '.py' | '.js' | '.ts' | '.java' | '.c' | '.cpp' | '.h' | '.css' | '.sql' | '.yaml' | '.yml' | '.ini' | '.cfg' | '.log':
                return DocumentType.text
            case _:
                return None

    match mime_type:
        case 'application/pdf':
            return DocumentType.pdf
        case mime if mime.startswith('video/'):
            return DocumentType.video
        case mime if mime.startswith('audio/'):
            return DocumentType.audio
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            return DocumentType.word
        case 'application/msword':
            return DocumentType.word
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
            return DocumentType.excel
        case 'application/vnd.ms-excel':
            return DocumentType.excel
        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
            return DocumentType.powerpoint
        case 'application/vnd.ms-powerpoint':
            return DocumentType.powerpoint
        case mime if mime.startswith('image/'):
            return DocumentType.image
        case mime if mime.startswith('text/'):
            return DocumentType.text
        case _:
            return None

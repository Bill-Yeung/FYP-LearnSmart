import base64
import logging
from pathlib import Path
from uuid import UUID
from zipfile import ZipFile, is_zipfile

from app.services.document.extraction_tree import ExtractionTree

logger = logging.getLogger(__name__)

class ZipProcessor:

    def process_sync(
        self,
        file_path: str,
        tree: ExtractionTree | None = None,
        parent_node_id: UUID | None = None) -> ExtractionTree:

        total_files = 0

        try:

            if not is_zipfile(file_path):
                raise ValueError(f"Not a valid ZIP file: {file_path}")

            doc_base_name = Path(file_path).stem

            if tree is None:
                tree = ExtractionTree()
                root_id = tree.add_root(
                    source_path = file_path,
                    document_type = "zip",
                    metadata = {})
            else:
                root_id = tree.add_child(
                    parent_id = parent_node_id,
                    source_path = file_path,
                    document_type = "zip",
                    extraction_type = "embedded_document",
                    metadata = {})

            # Extract files from ZIP (collected for later processing)
            with ZipFile(file_path, 'r') as zf:

                file_list = [name for name in zf.namelist() if not name.endswith('/')]

                for name in file_list:
                    try:

                        file_bytes = zf.read(name)
                        filename = Path(name).name
                        safe_filename = f"{doc_base_name}_{filename}"

                        tree.add_child(
                            parent_id = root_id,
                            source_path = f"{file_path}:file:{name}",
                            document_type = "embedded",
                            extraction_type = "embedded_document",
                            metadata = {
                                "data": base64.b64encode(file_bytes).decode('utf-8'),
                                "original_filename": name,
                                "file_size": len(file_bytes),
                                "suggested_filename": safe_filename})

                        total_files += 1
                        logger.debug(f"Extracted file from ZIP: {name}")

                    except Exception as e:
                        logger.debug(f"File extraction failed for {name}: {e}")

            logger.info(f"ZIP processed: {total_files} files extracted")

            return tree

        except Exception as e:
            logger.error(f"ZIP processing failed: {e}")
            raise

# Global instance
zip_processor = ZipProcessor()

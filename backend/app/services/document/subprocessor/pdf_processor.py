import logging
import fitz  # PyMuPDF
import base64
from pathlib import Path
from uuid import UUID

from app.services.document.subprocessor.image_processor import image_processor
from app.services.document.subprocessor.table_processor import table_processor
from app.services.document.subprocessor.image_classifier import should_keep_image
from app.services.document.extraction_tree import ExtractionTree

logger = logging.getLogger(__name__)

class PDFProcessor:

    def __init__(self):

        self.image_processor = image_processor
        self.table_processor = table_processor

    def process_sync(
        self,
        file_path: str,
        tree: ExtractionTree | None = None,
        parent_node_id: UUID | None = None) -> ExtractionTree:

        total_images = 0
        total_drawings = 0
        total_tables = 0
        total_forms = 0
        total_links = 0
        total_annotations = 0
        total_embedded = 0

        try:

            doc = fitz.open(file_path)
            doc_base_name = Path(file_path).stem

            if tree is None:
                tree = ExtractionTree()
                root_id = tree.add_root(
                    source_path = file_path,
                    document_type = "pdf",
                    metadata = {})
            else:
                root_id = tree.add_child(
                    parent_id = parent_node_id,
                    source_path = file_path,
                    document_type = "pdf",
                    extraction_type = "embedded_document",
                    metadata = {})

            full_page_ocr_count = 0

            for i, page in enumerate(doc):

                page_num = i + 1

                native_text = page.get_text()
                ocr_text = ""

                # Only OCR pages with little or no native text (scanned/rasterized pages)
                native_words = len(native_text.split()) if native_text else 0
                if native_words < 20:
                    try:
                        mat = fitz.Matrix(2, 2)
                        pix = page.get_pixmap(matrix = mat)
                        page_image_bytes = pix.tobytes("png")
                        ocr_result = self.image_processor.process(page_image_bytes)
                        if ocr_result.success and ocr_result.output_text:
                            ocr_text = ocr_result.output_text
                            full_page_ocr_count += 1
                    except Exception as ocr_error:
                        logger.debug(f"Full-page OCR failed for page {page_num}: {ocr_error}")

                if native_text.strip() and native_words >= 20:
                    text = native_text.strip()
                elif ocr_text.strip():
                    text = ocr_text.strip()
                else:
                    text = native_text.strip()

                page_node_id = tree.add_child(
                    parent_id = root_id,
                    source_path = f"{file_path}:page{page_num}",
                    document_type = "page",
                    extraction_type = "page",
                    metadata = {
                        "page_number": page_num,
                        "output_text": text})
                
                # Extract images, tables, links, annotations, RichMedia, form, drawings, embedded files from PDF

                # Extract images
                image_info_list = page.get_image_info(xrefs = True)
                logger.debug(f"Page {page_num}: Found {len(image_info_list)} images from get_image_info()")
                
                if image_info_list:

                    for img_idx, img_info in enumerate(image_info_list):

                        try:

                            xref = img_info.get("xref", 0)
                            if xref == 0:
                                logger.debug(f"Skipping inline image on page {page_num}")
                                continue
                            base_image = doc.extract_image(xref)
                            image_bytes = base_image["image"]

                            # Skip small images
                            width = base_image.get("width", 0)
                            height = base_image.get("height", 0)
                            if width < 50 or height < 50:
                                continue

                            image_ext = base_image.get("ext", "png")
                            output_text = ""

                            try:
                                ocr_result = self.image_processor.process(image_bytes)
                                output_text = ocr_result.output_text if ocr_result.success else ""
                            except Exception as ocr_error:
                                logger.debug(f"OCR failed for image on page {page_num}: {ocr_error}")

                            keep_image, keep_reason = should_keep_image(image_bytes, ocr_text=output_text)
                            if not keep_image:
                                logger.debug(f"Skipping image on page {page_num}: {keep_reason}")
                                continue

                            tree.add_child(
                                parent_id = page_node_id,
                                source_path = f"{file_path}:page{page_num}:image{img_idx}",
                                document_type = "image",
                                extraction_type = "image",
                                metadata = {
                                    "data": base64.b64encode(image_bytes).decode('utf-8'),
                                    "format": image_ext,
                                    "width": width,
                                    "height": height,
                                    "output_text": output_text,
                                    "keep_reason": keep_reason,
                                    "extraction_location": f"page {page_num}",
                                    "suggested_filename": f"{doc_base_name}_page{page_num}_img{img_idx}.{image_ext}"})
                            total_images += 1

                        except Exception as e:
                            logger.debug(f"Image extraction failed for image {img_idx} on page {page_num}: {e}")

                # Extract tables
                try:
                    tables = page.find_tables()
                    if tables:
                        for table_idx, table in enumerate(tables.tables):
                            try:

                                table_data = table.extract()
                                if not table_data:
                                    continue

                                table_result = self.table_processor.process(
                                    table_data = table_data)

                                if table_result.success:
                                    tree.add_child(
                                        parent_id = page_node_id,
                                        source_path = f"{file_path}:page{page_num}:table{table_idx}",
                                        document_type = "table",
                                        extraction_type = "table",
                                        metadata = {
                                            "output_text": table_result.output_text,
                                            "suggested_filename": f"{doc_base_name}_page{page_num}_table{table_idx}.csv"})
                                    total_tables += 1

                            except Exception as table_error:
                                logger.debug(f"Table extraction failed for table {table_idx} on page {page_num}: {table_error}")

                except Exception as e:
                    logger.debug(f"Table detection failed on page {page_num}: {e}")

                # Extract links
                try:
                    links = page.get_links()
                    if links:

                        pdf_link_type_map = {
                            1: "goto",
                            2: "uri",
                            3: "launch",
                            4: "named",
                            5: "gotor"
                        }

                        for link_idx, link in enumerate(links):

                            link_kind = link.get("kind", 0)
                            link_type = pdf_link_type_map.get(link_kind, "unknown")

                            if link_type == "goto" or link_type == "launch" or link_type == "named":
                                continue

                            uri = link.get("uri")
                            if not uri:
                                continue

                            tree.add_child(
                                parent_id = page_node_id,
                                source_path = f"{file_path}:page{page_num}:link{link_idx}",
                                document_type = "link",
                                extraction_type = "link",
                                metadata = {
                                    "uri": uri,
                                    "link_type": link_type,
                                    "output_text": link.get("id"),
                                    "extraction_location": f"page {page_num}"})
                            total_links += 1

                except Exception as e:
                    logger.debug(f"Link extraction failed on page {page_num}: {e}")

                # Extract annotations
                try:
                    annots = page.annots()
                    if annots:

                        for annot_idx, annot in enumerate(annots):

                            annot_type_tuple = annot.type
                            annot_type_name = annot_type_tuple[1] if annot_type_tuple else "Unknown"

                            if annot_type_name == "RichMedia":
                                try:

                                    logger.debug(f"Found RichMedia annotation on page {page_num}")
                                    if hasattr(annot, 'file_info') and annot.file_info:

                                        file_info = annot.file_info

                                        if 'content' in file_info:
                                            media_bytes = file_info['content']
                                            media_name = file_info.get('filename', f'richmedia_page{page_num}_{annot_idx}.bin')
                                            safe_media_name = media_name.replace("/", "_").replace("\\", "_")
                                            tree.add_child(
                                                parent_id = page_node_id,
                                                source_path = f"{file_path}:page{page_num}:media{total_embedded}",
                                                document_type = "embedded",
                                                extraction_type = "embedded_document",
                                                metadata = {
                                                    "data": base64.b64encode(media_bytes).decode('utf-8'),
                                                    "original_filename": media_name,
                                                    "file_size": len(media_bytes),
                                                    "extraction_location": f"page {page_num}",
                                                    "suggested_filename": f"{doc_base_name}_{safe_media_name}"})

                                            total_embedded += 1
                                            logger.debug(f"Extracted RichMedia: {media_name}")

                                        else:
                                            logger.debug(f"RichMedia on page {page_num}: file_info has no content")
                                    else:
                                        logger.debug(f"RichMedia on page {page_num}: no file_info attribute")

                                except Exception as rm_error:
                                    logger.debug(f"RichMedia extraction failed: {rm_error}")
                            
                            else:

                                info = annot.info or {}
                                tree.add_child(
                                    parent_id = page_node_id,
                                    source_path = f"{file_path}:page{page_num}:annot{annot_idx}",
                                    document_type = "annotation",
                                    extraction_type = "annotation",
                                    metadata = {
                                        "annot_type": annot_type_name.lower(),
                                        "author": info.get("title"),
                                        "timestamp": info.get("creationDate") or info.get("modDate"),
                                        "extraction_location": f"page {page_num}",
                                        "output_text": info.get("content")})
                                total_annotations += 1

                except Exception as e:
                    logger.debug(f"Annotation extraction failed on page {page_num}: {e}")

                # Extract form fields
                try:

                    widgets = page.widgets()
                    if widgets:

                        form_fields = {}
                        for widget in widgets:
                            field_name = widget.field_name or "unnamed"
                            form_fields[field_name] = widget.field_value

                        if form_fields:
                            output_text = "\n".join(f"{k}: {v}" for k, v in form_fields.items() if v)
                            tree.add_child(
                                parent_id = page_node_id,
                                source_path = f"{file_path}:page{page_num}:form",
                                document_type = "form",
                                extraction_type = "form",
                                metadata = {
                                    "fields": form_fields,
                                    "field_count": len(form_fields),
                                    "extraction_location": f"page {page_num}",
                                    "output_text": output_text})
                            total_forms += 1

                except Exception as e:
                    logger.debug(f"Form field extraction failed on page {page_num}: {e}")

                # Extract drawings
                try:
                    drawings = page.get_drawings()
                    if drawings:

                        clusters = page.cluster_drawings(drawings=drawings)
                        for cluster_idx, cluster in enumerate(clusters):

                            rects = [d["rect"] for d in cluster if isinstance(d, dict) and "rect" in d]
                            if not rects:
                                continue

                            x0 = min(r[0] for r in rects)
                            y0 = min(r[1] for r in rects)
                            x1 = max(r[2] for r in rects)
                            y1 = max(r[3] for r in rects)
                            width = x1 - x0
                            height = y1 - y0
                            if width < 50 or height < 50:
                                continue

                            clip_rect = fitz.Rect(x0, y0, x1, y1)
                            mat = fitz.Matrix(2, 2)
                            pix = page.get_pixmap(matrix=mat, clip=clip_rect)
                            image_bytes = pix.tobytes("png")

                            output_text = ""
                            try:
                                ocr_result = self.image_processor.process(image_bytes)
                                output_text = ocr_result.output_text if ocr_result.success else ""
                            except Exception:
                                pass

                            keep_drawing, keep_reason = should_keep_image(image_bytes, ocr_text=output_text)
                            if not keep_drawing:
                                logger.debug(f"Skipping drawing on page {page_num}: {keep_reason}")
                                continue

                            tree.add_child(
                                parent_id = page_node_id,
                                source_path = f"{file_path}:page{page_num}:drawing{cluster_idx}",
                                document_type = "image",
                                extraction_type = "image",
                                metadata = {
                                    "data": base64.b64encode(image_bytes).decode('utf-8'),
                                    "format": "png",
                                    "width": int(width),
                                    "height": int(height),
                                    "output_text": output_text,
                                    "keep_reason": keep_reason,
                                    "extraction_location": f"page {page_num}",
                                    "suggested_filename": f"{doc_base_name}_page{page_num}_drawing{cluster_idx}.png"})
                            total_drawings += 1

                except Exception as e:
                    logger.debug(f"Drawing extraction failed on page {page_num}: {e}")

            # Extract embedded files (collected for later processing)
            try:
                embfile_count = doc.embfile_count()
                if embfile_count > 0:

                    embfile_names = doc.embfile_names()

                    for emb_name in embfile_names:
                        try:

                            emb_data = doc.embfile_get(emb_name)

                            if emb_data:

                                safe_emb_name = emb_name.replace("/", "_").replace("\\", "_")
                                tree.add_child(
                                    parent_id = root_id,
                                    source_path = f"{file_path}:embedded:{emb_name}",
                                    document_type = "embedded",
                                    extraction_type = "embedded_document",
                                    metadata = {
                                        "data": base64.b64encode(emb_data).decode('utf-8'),
                                        "original_filename": emb_name,
                                        "file_size": len(emb_data),
                                        "extraction_location": "document",
                                        "suggested_filename": f"{doc_base_name}_{safe_emb_name}"})

                                total_embedded += 1
                                logger.debug(f"Extracted embedded file: {emb_name}")

                        except Exception as emb_error:
                            logger.debug(f"Embedded file extraction failed for {emb_name}: {emb_error}")

            except Exception as e:
                logger.debug(f"Embedded file detection failed: {e}")

            page_count = len(doc)
            doc.close()

            logger.info(f"PDF processed: {page_count} pages, "
                       f"Images: {total_images}, Tables: {total_tables}, "
                       f"Links: {total_links}, Annotations: {total_annotations}, "
                       f"Forms: {total_forms}, Drawings: {total_drawings}, "
                       f"Embedded: {total_embedded}, Full-page OCR: {full_page_ocr_count}")

            return tree

        except Exception as e:
            logger.error(f"PDF processing failed: {str(e)}")
            raise

# Global instance
pdf_processor = PDFProcessor()

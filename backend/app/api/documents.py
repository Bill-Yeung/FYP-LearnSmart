from fastapi import APIRouter, UploadFile, HTTPException, Depends, File, Form, Query
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
import asyncpg
from uuid import UUID
import logging
import zipfile
import os
import tempfile
import json
from io import BytesIO

from app.models import (
    DocumentType,
    ProcessingStatus,
    DocumentDetailResponse,
    ProcessingResultResponse,
    DocumentListItemResponse,
    DocumentListResponse)

from app.services.pipelines.document_pipeline import document_pipeline
from app.services.infrastructure.task_queue_manager import task_queue_manager, QueueType, UserPriority
from app.repositories.source_repository import SourceRepository
from app.repositories.media_repository import MediaRepository
from app.repositories.concept_repository import ConceptRepository
from app.repositories.relationship_repository import RelationshipRepository

from app.core.database import get_postgres, neo4j_db
from app.core.dependencies import get_current_user
from app.services.knowledge.citations import remove_citations_clean
from app.services.ai.provider import ai_provider
from app.services.document.subprocessor.image_classifier import quick_image_discard_reason

logger = logging.getLogger(__name__)
router = APIRouter(prefix = "/documents", tags = ["Documents"])

def get_user_priority(user: dict) -> UserPriority:

    if user["role"] == "admin":
        return UserPriority.PREMIUM
    elif user["role"] == "teacher":
        return UserPriority.VERIFIED

    return UserPriority.REGULAR

def extract_zip_recursive(content: bytes, max_depth: int = 10) -> list[tuple[str, bytes]]:

    extracted = []

    def recurse(data: bytes, depth: int):

        if depth > max_depth:

            logger.warning("Max ZIP nesting depth reached")
            return
        
        try:

            with zipfile.ZipFile(BytesIO(data), 'r') as zf:

                for info in zf.infolist():

                    if info.is_dir() or info.filename.startswith('__MACOSX') or info.filename.startswith('.'):
                        continue

                    file_bytes = zf.read(info.filename)
                    filename = os.path.basename(info.filename)

                    if not filename:
                        continue

                    if filename.lower().endswith('.zip'):
                        recurse(file_bytes, depth + 1)
                    else:
                        extracted.append((filename, file_bytes))

        except zipfile.BadZipFile:
            logger.warning("Invalid ZIP file encountered")

    recurse(content, 0)

    return extracted

def _media_metadata(row: asyncpg.Record) -> dict:

    metadata = row["metadata"]
    if isinstance(metadata, dict):
        return metadata
    if isinstance(metadata, str):
        try:
            parsed = json.loads(metadata)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}

def _resolve_media_storage_path(file_url: str | None) -> str | None:

    if not file_url:
        return None

    base_dir = "/app/uploads"
    if os.path.isabs(file_url):
        full_path = os.path.normpath(file_url)
    else:
        full_path = os.path.normpath(os.path.join(base_dir, file_url.lstrip("/")))

    if not full_path.startswith(base_dir):
        return None
    return full_path

def _should_show_document_media(row: asyncpg.Record) -> bool:

    if row["media_type"] != "image":
        return True

    metadata = _media_metadata(row)
    if metadata.get("display_media") is False or metadata.get("should_keep") is False:
        return False

    reason_text = " ".join(
        str(metadata.get(key, ""))
        for key in ("keep_reason", "classification_category", "category", "reason"))
    reason_text = reason_text.lower()

    discard_terms = (
        "background",
        "decorative",
        "gradient",
        "icon",
        "logo",
        "single color",
        "watermark")
    if any(term in reason_text for term in discard_terms):
        return False

    keep_terms = (
        "chart",
        "diagram",
        "educational",
        "flowchart",
        "graph",
        "infographic",
        "scientific",
        "schematic",
        "technical")
    if any(term in reason_text for term in keep_terms):
        return True

    file_path = _resolve_media_storage_path(row["file_url"])
    if file_path and os.path.exists(file_path):
        try:
            with open(file_path, "rb") as image_file:
                discard_reason = quick_image_discard_reason(image_file.read())
            if discard_reason:
                logger.debug(
                    "Hiding extracted image %s from document media: %s",
                    row["id"],
                    discard_reason)
                return False
        except Exception as exc:
            logger.debug("Could not run fast media display check for %s: %s", row["id"], exc)

    return True

def save_bytes_to_temp(filename: str, content: bytes) -> str:

    ext = os.path.splitext(filename)[1] or '.bin'
    
    with tempfile.NamedTemporaryFile(suffix = ext, delete = False) as tmp:
        tmp.write(content)
        return tmp.name

@router.post("/upload", response_model = list[ProcessingResultResponse])
async def upload_document(
    file: UploadFile | None = File(None),
    title: str | None = Form(None),
    content: str | None = Form(None),
    is_public: bool = Form(False),
    subject_ids: str | None = Form(None),
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)):
    
    #  accepts file or pasted text

    if not file and not content:
        raise HTTPException(status_code = 400, detail = "Must provide file or content")

    if content and not title:
        raise HTTPException(status_code = 400, detail = "Title required for text content")

    priority = get_user_priority(current_user)
    user_id = current_user["id"]

    subject_uuids: list[UUID] = []
    if subject_ids:
        for sid in subject_ids.split(","):
            sid = sid.strip()
            if sid:
                try:
                    subject_uuids.append(UUID(sid))
                except ValueError:
                    pass

    # Step 1: Collect all documents (text is saved as temp file)

    documents: list[tuple[any, str, str, bool]] = []
    temp_paths: list[str] = []

    try:

        if content:

            filename = f"{title}.txt"
            temp_path = save_bytes_to_temp(filename, content.encode('utf-8'))
            temp_paths.append(temp_path)
            documents.append((temp_path, filename, title, True))

        if file and file.filename:

            if file.filename.lower().endswith('.zip'):

                file_bytes = await file.read()
                extracted = extract_zip_recursive(file_bytes)

                if not extracted:
                    raise HTTPException(status_code = 400, detail = "ZIP file is empty or invalid")

                for fname, fbytes in extracted:
                    temp_path = save_bytes_to_temp(fname, fbytes)
                    temp_paths.append(temp_path)
                    documents.append((temp_path, fname, fname, True))

            else:

                documents.append((file, file.filename, title or file.filename, False))

        if not documents:
            raise HTTPException(status_code = 400, detail = "No valid files to process")

        # Step 2: For each document, upload and queue for processing

        results: list[ProcessingResultResponse] = []

        for file_obj, filename, doc_title, is_temp in documents:

            file_handle = None
            try:

                if is_temp:
                    file_handle = open(file_obj, 'rb')
                else:
                    file_handle = file_obj

                doc_id, doc_path, doc_type = await document_pipeline.upload_file(
                    file = file_handle,
                    filename = filename,
                    db = db,
                    title = doc_title,
                    is_public = is_public,
                    user_id = user_id,
                    subject_ids = subject_uuids if subject_uuids else None)

                task_queue_manager.submit_task(
                    QueueType.DOCUMENT_PROCESSING,
                    document_pipeline.process_file_background,
                    priority,
                    document_id = doc_id,
                    file_path = doc_path,
                    title = doc_title,
                    doc_type = doc_type,
                    user_id = str(user_id),
                    subject_ids = ",".join(str(s) for s in subject_uuids) if subject_uuids else None)

                results.append(ProcessingResultResponse(
                    success = True,
                    document_id = UUID(doc_id),
                    title = doc_title,
                    document_type = doc_type,
                    status = ProcessingStatus.pending,
                    message = "Document uploaded successfully."))

                logger.info(f"Document uploaded: {doc_id} | {doc_title}")

            except Exception as e:

                logger.warning(f"Failed to upload {filename}: {e}")
                results.append(ProcessingResultResponse(
                    success = False,
                    document_id = UUID("00000000-0000-0000-0000-000000000000"),
                    title = doc_title,
                    document_type = DocumentType.text,
                    status = ProcessingStatus.failed,
                    message = str(e)))
            finally:

                if is_temp and file_handle is not None:
                    try:
                        file_handle.close()
                    except Exception:
                        pass

        if not any(r.success for r in results):

            error_messages = [r.message for r in results if r.message]
            
            if error_messages:
                detail = "; ".join(error_messages)
            else:
                detail = "No files could be processed"
            raise HTTPException(status_code = 400, detail = detail)

        return results

    finally:

        for path in temp_paths:
            
            if os.path.exists(path):
                os.unlink(path)

@router.get("", response_model = DocumentListResponse)
async def list_documents(
    page: int = Query(1, ge = 1),
    page_size: int = Query(20, ge = 1, le = 100),
    document_type: DocumentType | None = None,
    status: ProcessingStatus | None = None,
    subject_id: UUID | None = None,
    query: str | None = None,
    search_mode: str = Query("hybrid"),
    title_only: bool = Query(False),
    sort: str = Query("uploaded_at"),
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    try:

        source_repo = SourceRepository(db)
        offset = (page - 1) * page_size

        if query and query.strip():
            if search_mode == "hybrid":

                from app.services.retrieval.hybrid_retrieval import hybrid_retrieval_service

                semantic_scores = await hybrid_retrieval_service.search_documents(
                    query = query.strip(),
                    top_k = page_size * 2,
                    score_threshold = 0.5)

                keyword_rows, _ = await source_repo.search_keyword(
                    user_id = current_user["id"],
                    query = query.strip(),
                    title_only = title_only,
                    document_type = document_type.value if document_type else None,
                    status = status.value if status else None,
                    subject_id = subject_id,
                    limit = page_size * 2,
                    offset = 0)

                seen_ids = set()
                combined_rows = []

                for row in keyword_rows:
                    doc_id = str(row["id"])
                    seen_ids.add(doc_id)
                    combined_rows.append(row)

                if semantic_scores:
                    semantic_only_ids = [
                        doc_id for doc_id in semantic_scores.keys()
                        if doc_id not in seen_ids
                    ]

                    if semantic_only_ids:
                        semantic_rows = await source_repo.get_by_ids(
                            user_id = current_user["id"],
                            document_ids = semantic_only_ids,
                            document_type = document_type.value if document_type else None,
                            status = status.value if status else None,
                            subject_id = subject_id)

                        semantic_rows_sorted = sorted(
                            semantic_rows,
                            key = lambda r: semantic_scores.get(str(r["id"]), 0.0),
                            reverse = True)

                        for row in semantic_rows_sorted:
                            if str(row["id"]) not in seen_ids:
                                seen_ids.add(str(row["id"]))
                                combined_rows.append(row)

                total = len(combined_rows)
                rows = combined_rows[offset:offset + page_size]
            else:

                rows, total = await source_repo.search_keyword(
                    user_id = current_user["id"],
                    query = query.strip(),
                    title_only = title_only,
                    document_type = document_type.value if document_type else None,
                    status = status.value if status else None,
                    subject_id = subject_id,
                    limit = page_size,
                    offset = offset)
        else:
            rows, total = await source_repo.get_by_user(
                user_id = current_user["id"],
                document_type = document_type.value if document_type else None,
                status = status.value if status else None,
                subject_id = subject_id,
                limit = page_size,
                offset = offset,
                sort_by = sort)

        source_ids = [row["id"] for row in rows]
        subjects_map: dict[str, list[dict]] = {}
        if source_ids:
            subject_rows = await db.fetch(
                """
                SELECT ss.source_id, sub.id, sub.code, sub.name
                FROM source_subjects ss
                INNER JOIN subjects sub ON ss.subject_id = sub.id
                WHERE ss.source_id = ANY($1::uuid[])
                ORDER BY sub.code
                """,
                source_ids)
            for sr in subject_rows:
                sid = str(sr["source_id"])
                if sid not in subjects_map:
                    subjects_map[sid] = []
                subjects_map[sid].append({"id": str(sr["id"]), "code": sr["code"], "name": sr["name"]})

        documents = [
            DocumentListItemResponse(
                id = row["id"],
                document_name = row["document_name"],
                document_type = DocumentType(row["document_type"])
                    if row["document_type"] in [e.value for e in DocumentType] else DocumentType.text,
                processing_status = ProcessingStatus(row["processing_status"]) if row["processing_status"] else ProcessingStatus.pending,
                author = row["author"],
                language = row["language"],
                is_public = row["is_public"],
                uploaded_at = row["uploaded_at"],
                concepts_extracted = row["concepts_extracted"] or 0,
                relationships_extracted = row["relationships_extracted"] or 0,
                subjects = subjects_map.get(str(row["id"]), []))
            for row in rows]

        return DocumentListResponse(
            documents = documents,
            total = total,
            page = page,
            page_size = page_size)

    except Exception as e:
        logger.error(f"List documents failed: {e}")
        raise HTTPException(status_code = 500, detail=str(e))


@router.get("/processing/stats")
async def get_processing_stats(
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    try:
        source_repo = SourceRepository(db)
        rows = await db.fetch(
            """
            SELECT processing_status, COUNT(*) as count
            FROM sources
            WHERE uploaded_by = $1 AND deleted_at IS NULL
            GROUP BY processing_status
            """,
            current_user["id"])
        counts = {"pending": 0, "processing": 0, "completed": 0, "failed": 0}
        for row in rows:
            status = row["processing_status"]
            if status in counts:
                counts[status] = row["count"]
        return counts
    except Exception as e:
        logger.error(f"Get processing stats failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{document_id}", response_model = DocumentDetailResponse)
async def get_document(
    document_id: UUID,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    try:
        source_repo = SourceRepository(db)
        row = await source_repo.get_by_id_and_user(
            source_id = document_id,
            user_id = current_user["id"])

        if not row:
            shared = await db.fetchval(
                """
                SELECT 1 FROM shared_content sc
                JOIN community_members cm ON cm.community_id = ANY(sc.community_ids)
                    AND cm.user_id = $2 AND cm.status = 'active' AND cm.role != 'pending'
                WHERE sc.entity_id = $1 AND sc.entity_type = 'source' AND sc.status = 'active'
                LIMIT 1
                """,
                document_id, current_user["id"],
            )
            if shared:
                row = await source_repo.get_by_id(document_id)

        if not row:
            raise HTTPException(status_code=404, detail="Document not found")

        concept_repo = ConceptRepository(db)
        relationship_repo = RelationshipRepository(db)
        _, concepts_count = await concept_repo.get_by_source(document_id, limit=1, offset=0)
        _, relationships_count = await relationship_repo.get_by_source(document_id, limit=1, offset=0)

        subject_rows = await source_repo.get_subjects(document_id)
        subjects = [{"id": str(s["id"]), "code": s["code"], "name": s["name"]} for s in subject_rows]

        return DocumentDetailResponse(
            id = row["id"],
            document_name = row["document_name"],
            document_path = row["document_path"],
            document_type = DocumentType(row["document_type"])
                if row["document_type"] in [e.value for e in DocumentType] else DocumentType.text,
            language = row["language"],
            author = row["author"],
            publication_year = row["publication_year"],
            uploaded_by = row["uploaded_by"],
            is_public = row["is_public"],
            uploaded_at = row["uploaded_at"],
            processing_status = ProcessingStatus(row["processing_status"]) if row["processing_status"] else ProcessingStatus.pending,
            processing_error = row["processing_error"],
            processing_started_at = row["processing_started_at"],
            processing_completed_at = row["processing_completed_at"],
            concepts_extracted = concepts_count,
            relationships_extracted = relationships_count,
            ai_summary = row["ai_summary"],
            ai_summary_generated_at = row["ai_summary_generated_at"],
            subjects = subjects,
            deleted_at = row["deleted_at"])

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Get document failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{document_id}")
async def delete_document(
    document_id: UUID,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    try:

        source_repo = SourceRepository(db)
        row = await source_repo.get_path_and_deleted(
            source_id = document_id,
            user_id = current_user["id"])

        if not row:
            raise HTTPException(status_code = 404, detail = "Document not found")

        if row["deleted_at"]:
            raise HTTPException(status_code = 410, detail = "Document already deleted")

        await source_repo.soft_delete(document_id)
        return {"message": "Document deleted successfully", "document_id": str(document_id)}

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Delete document failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{document_id}/status")
async def get_document_status(
    document_id: UUID,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    try:

        source_repo = SourceRepository(db)
        row = await source_repo.get_status_by_id_and_user(
            source_id=document_id,
            user_id=current_user["id"])

        if not row:
            raise HTTPException(status_code=404, detail="Document not found")

        return {
            "status": row["processing_status"] or "pending",
            "error_message": row["processing_error"]}

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Get document status failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/deleted/list")
async def list_deleted_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    try:

        source_repo = SourceRepository(db)
        offset = (page - 1) * page_size

        rows, total = await source_repo.get_deleted_by_user(
            user_id = current_user["id"],
            limit = page_size,
            offset = offset)

        documents = [{
                "id": row["id"],
                "document_name": row["document_name"],
                "document_type": row["document_type"],
                "processing_status": row["processing_status"],
                "deleted_at": row["deleted_at"].isoformat() if row["deleted_at"] else None,
                "uploaded_at": row["uploaded_at"].isoformat() if row["uploaded_at"] else None,
                "concepts_extracted": row["concepts_extracted"] or 0,
                "relationships_extracted": row["relationships_extracted"] or 0} for row in rows]

        return {
            "documents": documents,
            "total": total,
            "page": page,
            "page_size": page_size}

    except Exception as e:
        logger.error(f"List deleted documents failed: {e}")
        raise HTTPException(status_code = 500, detail = str(e))

@router.post("/{document_id}/restore")
async def restore_document(
    document_id: UUID,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    try:

        source_repo = SourceRepository(db)
        success = await source_repo.restore(document_id, current_user["id"])

        if not success:
            raise HTTPException(status_code = 404, detail = "Document not found or not deleted")

        return {"message": "Document restored successfully", "document_id": str(document_id)}

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Restore document failed: {e}")
        raise HTTPException(status_code = 500, detail = str(e))

@router.get("/{document_id}/download")
async def download_document(
    document_id: UUID,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    try:

        source_repo = SourceRepository(db)
        doc = await source_repo.get_by_id_and_user(
            source_id=document_id,
            user_id=current_user["id"])

        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        file_path = doc["document_path"]
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")

        # Determine content type
        ext = os.path.splitext(file_path)[1].lower()
        content_types = {
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.ppt': 'application/vnd.ms-powerpoint',
            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            '.txt': 'text/plain',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.mp3': 'audio/mpeg',
            '.mp4': 'video/mp4'}
        content_type = content_types.get(ext, 'application/octet-stream')

        filename = doc["document_name"]
        if not filename.endswith(ext):
            filename = f"{filename}{ext}"

        return FileResponse(
            path=file_path,
            media_type=content_type,
            filename=filename,
            headers={"Cache-Control": "private, max-age=3600"},
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Download document failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{document_id}/media")
async def get_document_media(
    document_id: UUID,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    try:

        source_repo = SourceRepository(db)
        doc = await source_repo.get_by_id_and_user(
            source_id=document_id,
            user_id=current_user["id"])

        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        media_repo = MediaRepository(db)
        media_rows = await media_repo.get_by_source(document_id)
        visible_media_rows = [row for row in media_rows if _should_show_document_media(row)]

        media = [{
                "id": str(row["id"]),
                "media_type": row["media_type"],
                "file_url": row["file_url"],
                "extraction_location": row["extraction_location"],
                "content": row["content"],
                "metadata": row["metadata"]} for row in visible_media_rows]

        return {"media": media, "total": len(media)}

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Get document media failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{document_id}/media/{media_id}/file")
async def serve_media_file(
    document_id: UUID,
    media_id: UUID,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    source_repo = SourceRepository(db)
    doc = await source_repo.get_by_id_and_user(
        source_id = document_id,
        user_id = current_user["id"])

    if not doc:
        raise HTTPException(status_code = 404, detail = "Document not found")

    media_repo = MediaRepository(db)
    media = await media_repo.get_by_id(media_id)

    if not media or str(media["source_id"]) != str(document_id):
        raise HTTPException(status_code = 404, detail = "Media not found")

    file_url = media["file_url"]
    if not file_url:
        raise HTTPException(status_code = 404, detail = "File not available")

    base_dir = "/app/uploads"
    full_path = os.path.normpath(os.path.join(base_dir, file_url))

    if not full_path.startswith(base_dir):
        raise HTTPException(status_code = 403, detail = "Access denied")

    if not os.path.exists(full_path):
        raise HTTPException(status_code = 404, detail = "File not found")

    ext = os.path.splitext(full_path)[1].lower()
    media_types = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.pdf': 'application/pdf'}

    content_type = media_types.get(ext, 'application/octet-stream')

    return FileResponse(
        path = full_path,
        media_type = content_type,
        filename = os.path.basename(full_path))


@router.get("/{document_id}/concepts")
async def get_document_concepts(
    document_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    user_id = UUID(str(current_user["id"]))

    source_repo = SourceRepository(db)
    document = await source_repo.get_by_id(document_id)

    if not document:
        raise HTTPException(status_code = 404, detail = "Document not found")

    if document["deleted_at"] is not None:
        raise HTTPException(status_code = 404, detail = "Document has been deleted")

    if document["uploaded_by"] != user_id and not document["is_public"]:
        raise HTTPException(status_code = 403, detail = "Access denied")

    offset = (page - 1) * page_size
    concept_repo = ConceptRepository(db)
    concepts, total = await concept_repo.get_by_source(
        source_id = document_id,
        limit = page_size,
        offset = offset)

    cleaned_concepts = []
    for c in concepts:
        concept_dict = dict(c)
        if concept_dict.get("description"):
            concept_dict["description"] = remove_citations_clean(concept_dict["description"])
        pages = concept_dict.pop("pages", None)
        if pages:
            concept_dict["page_numbers"] = ", ".join(str(p) for p in sorted(pages))
        else:
            concept_dict["page_numbers"] = None
        cleaned_concepts.append(concept_dict)

    return {
        "concepts": cleaned_concepts,
        "total": total,
        "page": page,
        "page_size": page_size}

@router.get("/{document_id}/relationships")
async def get_document_relationships(
    document_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    user_id = UUID(str(current_user["id"]))

    source_repo = SourceRepository(db)
    document = await source_repo.get_by_id(document_id)

    if not document:
        raise HTTPException(status_code = 404, detail = "Document not found")

    if document["deleted_at"] is not None:
        raise HTTPException(status_code = 404, detail = "Document has been deleted")

    if document["uploaded_by"] != user_id and not document["is_public"]:
        raise HTTPException(status_code = 403, detail = "Access denied")

    offset = (page - 1) * page_size
    relationship_repo = RelationshipRepository(db)
    relationships, total = await relationship_repo.get_by_source(
        source_id = document_id,
        limit = page_size,
        offset = offset)

    cleaned_relationships = []
    for r in relationships:
        rel_dict = dict(r)
        if rel_dict.get("description"):
            rel_dict["description"] = remove_citations_clean(rel_dict["description"])
        cleaned_relationships.append(rel_dict)

    return {
        "relationships": cleaned_relationships,
        "total": total,
        "page": page,
        "page_size": page_size}

@router.get("/knowledge-map/data")
async def get_knowledge_map_data(
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    user_id = UUID(str(current_user["id"]))
    concept_repo = ConceptRepository(db)
    concepts = await concept_repo.get_all_for_user(user_id)

    concept_ids = [c["id"] for c in concepts]

    if not concept_ids:
        return {"concepts": [], "relationships": [], "total_concepts": 0, "total_relationships": 0}

    relationships = await db.fetch(
        """
        SELECT DISTINCT ON (cr.id)
            cr.id,
            cr.source_concept_id,
            cr.target_concept_id,
            cr.strength,
            r.relationship_type
        FROM concept_relationships cr
        JOIN relationships r ON cr.relationship_id = r.id
        WHERE cr.source_concept_id = ANY($1::uuid[])
          AND cr.target_concept_id = ANY($1::uuid[])
        ORDER BY cr.id
        LIMIT 2000
        """,
        concept_ids)

    cleaned_concepts = []
    for c in concepts:
        cd = dict(c)
        cd["id"] = str(cd["id"])
        if cd.get("description"):
            cd["description"] = remove_citations_clean(cd["description"])
        cleaned_concepts.append(cd)

    cleaned_relationships = []
    for r in relationships:
        rd = dict(r)
        rd["id"] = str(rd["id"])
        rd["source_concept_id"] = str(rd["source_concept_id"])
        rd["target_concept_id"] = str(rd["target_concept_id"])
        cleaned_relationships.append(rd)

    return {
        "concepts": cleaned_concepts,
        "relationships": cleaned_relationships,
        "total_concepts": len(cleaned_concepts),
        "total_relationships": len(cleaned_relationships)}

@router.post("/{document_id}/generate-summary")
async def generate_summary(
    document_id: UUID,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    try:

        from app.repositories.gamification_repository import GamificationRepository
        gam = GamificationRepository(db)
        if not await gam.check_and_consume(current_user["id"], "ai_summary"):
            raise HTTPException(status_code=402, detail="You need an AI Summary Token to generate summaries. Purchase one from the Rewards Shop.")

        source_repo = SourceRepository(db)
        doc = await source_repo.get_by_id_and_user(
            source_id=document_id, user_id=current_user["id"])

        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        if doc["processing_status"] != "completed":
            raise HTTPException(status_code=400, detail="Document processing not completed")

        full_text = doc.get("full_text")
        if not full_text:
            raise HTTPException(status_code=400, detail="No text content available for summarization")

        system_prompt = (
            "You are a helpful academic assistant. Generate a concise, well-structured summary "
            "of the following document content. Focus on the key concepts, main arguments, and "
            "important conclusions. Use clear paragraphs.")

        chunk_size = 4000
        if len(full_text) <= chunk_size:

            async def _ai_short_summary():
                async with ai_provider.session(system_prompt=system_prompt) as session:
                    return await ai_provider.generate(
                        prompt=f"Please summarize the following document content:\n\n{full_text}",
                        session=session, temperature=0.3, max_tokens=1024)

            summary = await task_queue_manager.submit_and_wait(
                QueueType.AI_GENERATION, _ai_short_summary, UserPriority.REGULAR)
        else:

            chunks = [full_text[i:i + chunk_size] for i in range(0, len(full_text), chunk_size)]
            chunk_summaries = []
            for idx, chunk in enumerate(chunks):
                async def _ai_chunk(c=chunk, i=idx):
                    async with ai_provider.session(system_prompt=system_prompt) as session:
                        return await ai_provider.generate(
                            prompt=f"Summarize this section (part {i + 1} of {len(chunks)}):\n\n{c}",
                            session=session, temperature=0.3, max_tokens=512)

                chunk_summary = await task_queue_manager.submit_and_wait(
                    QueueType.AI_GENERATION, _ai_chunk, UserPriority.REGULAR)
                chunk_summaries.append(chunk_summary)

            merged_text = "\n\n".join(chunk_summaries)

            async def _ai_merge():
                async with ai_provider.session(system_prompt=system_prompt) as session:
                    return await ai_provider.generate(
                        prompt=(
                            "Below are summaries of different sections of a document. "
                            "Combine them into one coherent, well-structured summary:\n\n"
                            + merged_text
                        ),
                        session=session, temperature=0.3, max_tokens=1024)

            summary = await task_queue_manager.submit_and_wait(
                QueueType.AI_GENERATION, _ai_merge, UserPriority.REGULAR)

        await source_repo.update_ai_summary(document_id, summary)
        return {"ai_summary": summary, "ai_summary_generated_at": "now"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Generate summary failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{document_id}/retry")
async def retry_document(
    document_id: UUID,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    try:
        source_repo = SourceRepository(db)
        doc = await source_repo.get_by_id_and_user(
            source_id=document_id, user_id=current_user["id"])

        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        if doc["processing_status"] != "failed":
            raise HTTPException(status_code=400, detail="Only failed documents can be retried")

        await source_repo.update_status(document_id, ProcessingStatus.pending)

        priority = get_user_priority(current_user)
        task_queue_manager.submit_task(
            QueueType.DOCUMENT_PROCESSING,
            document_pipeline.process_file_background,
            priority,
            document_id=str(document_id),
            file_path=doc["document_path"],
            title=doc["document_name"],
            doc_type=doc["document_type"],
            user_id=str(current_user["id"]))

        return {"message": "Document requeued for processing", "document_id": str(document_id)}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Retry document failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class CompareRequest(BaseModel):
    concept_ids: list[str]

@router.post("/concepts/compare")
async def compare_concepts(
    req: CompareRequest,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    try:
        if len(req.concept_ids) < 2:
            raise HTTPException(status_code=400, detail="At least 2 concept IDs required")

        concept_repo = ConceptRepository(db)
        uuids = [UUID(cid) for cid in req.concept_ids]
        concepts = await concept_repo.get_by_ids(uuids)

        result = []
        for c in concepts:
            cd = dict(c)
            cd["id"] = str(cd["id"])
            result.append(cd)

        return {"concepts": result}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Compare concepts failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/concepts/all")
async def list_all_user_concepts(
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    try:
        concept_repo = ConceptRepository(db)
        rows = await concept_repo.get_all_for_user(UUID(str(current_user["id"])))
        concepts = []
        for c in rows:
            concepts.append({
                "id": str(c["id"]),
                "title": c.get("title") or "Untitled",
                "description": remove_citations_clean(c.get("description") or "") if c.get("description") else None,
                "concept_type": c.get("concept_type"),
                "difficulty_level": c.get("difficulty_level"),
                "keywords": c.get("keywords") or [],
            })
        return {"concepts": concepts, "total": len(concepts)}
    except Exception as e:
        logger.error(f"List all user concepts failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/concepts/{concept_id}")
async def get_concept_detail(
    concept_id: str,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user=Depends(get_current_user)):

    try:
        row = await db.fetchrow("""
            SELECT c.id, c.concept_type, c.difficulty_level, c.estimated_study_time_minutes,
                   ct.title, ct.description, ct.keywords
            FROM concepts c
            LEFT JOIN concept_translations ct ON ct.concept_id = c.id AND ct.language = 'en'
            WHERE c.id = $1::uuid
        """, concept_id)
        if not row:
            raise HTTPException(status_code=404, detail="Concept not found")
        desc = row.get("description") or ""
        if desc:
            desc = remove_citations_clean(desc)
        return {
            "id": str(row["id"]),
            "title": row.get("title") or "Untitled",
            "concept_type": row.get("concept_type"),
            "difficulty_level": row.get("difficulty_level"),
            "estimated_study_time_minutes": row.get("estimated_study_time_minutes"),
            "description": desc,
            "keywords": row.get("keywords") or [],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get concept detail failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/knowledge-base/subjects")
async def get_kb_subjects(
    db: asyncpg.Connection = Depends(get_postgres),
    current_user=Depends(get_current_user)
):

    try:
        user_id = UUID(str(current_user["id"]))
        rows = await db.fetch(
            """
            SELECT DISTINCT s.id, s.code, s.name, s.description,
                   COUNT(DISTINCT cs.concept_id) AS concept_count
            FROM subjects s
            JOIN concept_subjects cs ON s.id = cs.subject_id
            JOIN concepts c ON cs.concept_id = c.id
            JOIN concept_sources csrc ON c.id = csrc.concept_id
            JOIN sources src ON csrc.source_id = src.id
            WHERE src.uploaded_by = $1
              AND src.deleted_at IS NULL
              AND s.deleted_at IS NULL
            GROUP BY s.id, s.code, s.name, s.description
            ORDER BY concept_count DESC, s.name ASC
            """,
            user_id
        )
        return {
            "subjects": [
                {
                    "id": str(r["id"]),
                    "code": r["code"],
                    "name": r["name"],
                    "description": r["description"],
                    "concept_count": r["concept_count"],
                }
                for r in rows
            ],
            "total": len(rows),
        }
    except Exception as e:
        logger.error(f"get_kb_subjects failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/knowledge-base/tags")
async def get_kb_tags(
    db: asyncpg.Connection = Depends(get_postgres),
    current_user=Depends(get_current_user)
):

    try:
        user_id = UUID(str(current_user["id"]))
        rows = await db.fetch(
            """
            SELECT kw AS keyword, COUNT(*) AS frequency
            FROM (
                SELECT unnest(ct.keywords) AS kw
                FROM concept_translations ct
                JOIN concepts c ON ct.concept_id = c.id
                JOIN concept_sources csrc ON c.id = csrc.concept_id
                JOIN sources src ON csrc.source_id = src.id
                WHERE src.uploaded_by = $1
                  AND src.deleted_at IS NULL
                  AND ct.keywords IS NOT NULL
                  AND array_length(ct.keywords, 1) > 0
            ) kws
            WHERE kw IS NOT NULL AND trim(kw) != ''
            GROUP BY kw
            ORDER BY frequency DESC, kw ASC
            LIMIT 200
            """,
            user_id
        )
        return {
            "tags": [
                {"tag": r["keyword"], "frequency": r["frequency"]}
                for r in rows
            ],
            "total": len(rows),
        }
    except Exception as e:
        logger.error(f"get_kb_tags failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/search/query")
async def search_knowledge(
    q: str = Query(..., min_length=1, max_length=500),
    search_type: str = Query("keyword"),
    limit: int = Query(20, ge=1, le=100),
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    try:
        results = []
        seen_ids = set()

        if search_type in ("keyword", "hybrid"):
            concept_repo = ConceptRepository(db)
            keyword_results, _ = await concept_repo.search_by_title(q, limit=limit)
            for row in keyword_results:
                cid = str(row["id"])
                if cid not in seen_ids:
                    seen_ids.add(cid)
                    results.append({
                        "concept_id": cid,
                        "title": row["title"],
                        "description": row.get("description", ""),
                        "concept_type": row.get("concept_type", ""),
                        "difficulty_level": row.get("difficulty_level"),
                        "score": float(row.get("score", 0)),
                        "match_type": "keyword"})

        if search_type in ("semantic", "hybrid"):
            try:
                from app.repositories.qdrant_repository import qdrant_repository
                embedding = await ai_provider.get_embedding(q)
                qdrant_results = await qdrant_repository.search(
                    collection_name="concepts", query_vector=embedding, limit=limit)

                concept_repo = ConceptRepository(db)
                for point in qdrant_results:
                    cid = str(point.id)
                    if cid in seen_ids:
                        for r in results:
                            if r["concept_id"] == cid:
                                r["match_type"] = "both"
                                r["score"] = max(r["score"], point.score)
                                break
                    else:
                        seen_ids.add(cid)
                        concept = await concept_repo.get_with_translation(concept_id=UUID(cid))
                        results.append({
                            "concept_id": cid,
                            "title": concept["title"] if concept else "Unknown",
                            "description": concept.get("description", "") if concept else "",
                            "concept_type": concept.get("concept_type", "") if concept else "",
                            "difficulty_level": concept.get("difficulty_level") if concept else None,
                            "score": point.score,
                            "match_type": "semantic"})
            except Exception as e:
                logger.warning(f"Semantic search failed: {e}")
                if search_type == "semantic":
                    raise HTTPException(status_code=503, detail="Semantic search unavailable")

        results.sort(key=lambda x: x["score"], reverse=True)
        return {"results": results[:limit], "total": len(results), "query": q, "search_type": search_type}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{document_id}/analytics")
async def get_document_analytics(
    document_id: UUID,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    try:
        source_repo = SourceRepository(db)
        doc = await source_repo.get_by_id_and_user(
            source_id=document_id, user_id=current_user["id"])

        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        concept_type_counts = await db.fetch(
            """
            SELECT c.concept_type, COUNT(*) as count
            FROM concepts c
            INNER JOIN concept_sources cs ON c.id = cs.concept_id
            WHERE cs.source_id = $1
            GROUP BY c.concept_type ORDER BY count DESC
            """, document_id)

        difficulty_counts = await db.fetch(
            """
            SELECT c.difficulty_level, COUNT(*) as count
            FROM concepts c
            INNER JOIN concept_sources cs ON c.id = cs.concept_id
            WHERE cs.source_id = $1 AND c.difficulty_level IS NOT NULL
            GROUP BY c.difficulty_level ORDER BY count DESC
            """, document_id)

        relationship_type_counts = await db.fetch(
            """
            SELECT r.relationship_type, COUNT(*) as count
            FROM concept_relationships cr
            INNER JOIN relationships r ON cr.relationship_id = r.id
            INNER JOIN relationship_sources rs ON cr.id = rs.relationship_id
            WHERE rs.source_id = $1
            GROUP BY r.relationship_type ORDER BY count DESC
            """, document_id)

        processing_time = None
        if doc["processing_started_at"] and doc["processing_completed_at"]:
            delta = doc["processing_completed_at"] - doc["processing_started_at"]
            processing_time = round(delta.total_seconds(), 1)

        concept_repo = ConceptRepository(db)
        relationship_repo = RelationshipRepository(db)
        _, total_concepts = await concept_repo.get_by_source(document_id, limit=1, offset=0)
        _, total_relationships = await relationship_repo.get_by_source(document_id, limit=1, offset=0)

        return {
            "total_concepts": total_concepts,
            "total_relationships": total_relationships,
            "processing_time_seconds": processing_time,
            "concept_type_distribution": [
                {"type": row["concept_type"], "count": row["count"]} for row in concept_type_counts],
            "difficulty_distribution": [
                {"level": row["difficulty_level"], "count": row["count"]} for row in difficulty_counts],
            "relationship_type_distribution": [
                {"type": row["relationship_type"], "count": row["count"]} for row in relationship_type_counts]}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get document analytics failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/duplicates/scan")
async def find_duplicates(
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    try:
        concept_repo = ConceptRepository(db)
        concepts = await concept_repo.get_all_for_user(current_user["id"])

        if not concepts:
            return {"duplicate_groups": []}

        # Use trigram similarity to find duplicates via SQL (no Qdrant dependency)
        duplicates = await db.fetch(
            """
            SELECT
                c1.id AS id_a, ct1.title AS title_a, c1.concept_type AS type_a,
                LEFT(ct1.description, 200) AS desc_a,
                c2.id AS id_b, ct2.title AS title_b, c2.concept_type AS type_b,
                LEFT(ct2.description, 200) AS desc_b,
                similarity(ct1.title, ct2.title) AS sim
            FROM concepts c1
            INNER JOIN concept_sources cs1 ON c1.id = cs1.concept_id
            INNER JOIN sources s1 ON cs1.source_id = s1.id
            INNER JOIN concept_translations ct1 ON c1.id = ct1.concept_id AND ct1.is_primary = TRUE
            INNER JOIN concepts c2 ON c1.id < c2.id
            INNER JOIN concept_sources cs2 ON c2.id = cs2.concept_id
            INNER JOIN sources s2 ON cs2.source_id = s2.id
            INNER JOIN concept_translations ct2 ON c2.id = ct2.concept_id AND ct2.is_primary = TRUE
            WHERE s1.uploaded_by = $1 AND s1.deleted_at IS NULL
              AND s2.uploaded_by = $1 AND s2.deleted_at IS NULL
              AND similarity(ct1.title, ct2.title) >= 0.5
            ORDER BY sim DESC
            LIMIT 50
            """,
            current_user["id"])

        groups = []
        for row in duplicates:
            sim = float(row["sim"])
            if sim >= 0.95:
                tier, action = "exact", "merge"
            elif sim >= 0.8:
                tier, action = "high", "merge"
            else:
                tier, action = "moderate", "link"

            groups.append({
                "concept_a": {"id": str(row["id_a"]), "title": row["title_a"],
                              "concept_type": row["type_a"], "description": row["desc_a"] or ""},
                "concept_b": {"id": str(row["id_b"]), "title": row["title_b"],
                              "concept_type": row["type_b"], "description": row["desc_b"] or ""},
                "similarity_score": round(sim, 3),
                "tier": tier,
                "suggested_action": action})

        return {"duplicate_groups": groups}

    except Exception as e:
        logger.error(f"Find duplicates failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ResolveRequest(BaseModel):
    concept_a_id: UUID
    concept_b_id: UUID
    action: str

@router.post("/duplicates/resolve")
async def resolve_duplicate(
    req: ResolveRequest,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    try:
        concept_repo = ConceptRepository(db)
        concept_a = await concept_repo.get_by_id(req.concept_a_id)
        concept_b = await concept_repo.get_by_id(req.concept_b_id)

        if not concept_a or not concept_b:
            raise HTTPException(status_code=404, detail="One or both concepts not found")

        if req.action == "merge":
            b_trans = await concept_repo.get_with_translation(req.concept_b_id)
            if b_trans and b_trans.get("description"):
                await concept_repo.append_description(
                    req.concept_a_id, "en", b_trans["description"], b_trans.get("keywords"))

            await db.execute(
                """
                UPDATE concept_sources SET concept_id = $1
                WHERE concept_id = $2
                AND NOT EXISTS (
                    SELECT 1 FROM concept_sources WHERE concept_id = $1 AND source_id = concept_sources.source_id)
                """, req.concept_a_id, req.concept_b_id)
            await concept_repo.delete(req.concept_b_id)
            return {"message": "Concepts merged", "kept": str(req.concept_a_id), "deleted": str(req.concept_b_id)}

        elif req.action == "link":
            relationship_repo = RelationshipRepository(db)
            rel_type = await relationship_repo.find_type_by_name("similar_to")
            if not rel_type:
                rel_type = await relationship_repo.create_type("similar_to", "bidirectional", 0.8)
            await relationship_repo.create_concept_relationship(
                relationship_id=rel_type["id"],
                source_concept_id=req.concept_a_id,
                target_concept_id=req.concept_b_id, strength=0.9)
            return {"message": "Concepts linked as similar"}

        elif req.action == "keep_separate":
            return {"message": "Concepts kept separate"}

        else:
            raise HTTPException(status_code=400, detail="Invalid action. Use: merge, link, or keep_separate")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Resolve duplicate failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{document_id}/export/pdf")
async def export_document_pdf(
    document_id: UUID,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    try:
        source_repo = SourceRepository(db)
        doc = await source_repo.get_by_id_and_user(
            source_id=document_id, user_id=current_user["id"])

        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        concept_repo = ConceptRepository(db)
        relationship_repo = RelationshipRepository(db)
        concepts, _ = await concept_repo.get_by_source(document_id, limit=500, offset=0)
        relationships, _ = await relationship_repo.get_by_source(document_id, limit=500, offset=0)

        from app.services.export.pdf_export_service import generate_document_pdf
        pdf_bytes = generate_document_pdf(doc, concepts, relationships)

        filename = f"{doc['document_name']}_report.pdf"
        return StreamingResponse(
            iter([pdf_bytes]),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'})

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Export PDF failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

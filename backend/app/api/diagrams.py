from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from uuid import UUID
from typing import Optional
import json
import logging

from app.core.database import get_postgres
from app.core.dependencies import get_current_user
from app.repositories.diagram_repository import DiagramRepository
from app.repositories.concept_repository import ConceptRepository
from app.repositories.learningpath_repository import LearningPathRepository
from app.repositories.procedure_repository import ProcedureRepository
from app.repositories.neo4j_repository import (
    neo4j_repository, DOWNWARD_TYPES, UPWARD_TYPES, LATERAL_TYPES,
    TEMPORAL_TYPES, BIDIRECTIONAL_TYPES)
from app.services.knowledge.citations import remove_citations_clean

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/diagrams", tags=["Diagrams & Maps"])

class GenerateDiagramRequest(BaseModel):
    title: str = Field(default = "Knowledge Map", max_length = 500)
    diagram_type: str = Field(default = "knowledge_map")
    document_ids: Optional[list[UUID]] = None
    concept_ids: Optional[list[UUID]] = None
    learning_path_ids: Optional[list[UUID]] = None
    subject_id: Optional[UUID] = None
    expand: bool = Field(default = True)
    expand_depth: int = Field(default = 0, ge = 0, le = 10)
    include_lateral: bool = Field(default = True)
    include_upward: bool = Field(default = False)
    show_taxonomy: bool = Field(default = False)

class UpdateDiagramRequest(BaseModel):
    title: Optional[str] = Field(default = None, max_length = 500)
    description: Optional[str] = None
    diagram_data: Optional[dict] = None
    view_state: Optional[dict] = None
    is_edited: Optional[bool] = None

def _serialize_row(r) -> dict:
    d = dict(r)
    d["id"] = str(d["id"])
    if "user_id" in d:
        d["user_id"] = str(d["user_id"])
    if d.get("source_document_ids"):
        d["source_document_ids"] = [str(sid) for sid in d["source_document_ids"]]
    if d.get("source_concept_ids"):
        d["source_concept_ids"] = [str(sid) for sid in d["source_concept_ids"]]
    if isinstance(d.get("diagram_data"), str):
        d["diagram_data"] = json.loads(d["diagram_data"])
    if isinstance(d.get("view_state"), str):
        d["view_state"] = json.loads(d["view_state"])
    return d

def _loads_json_list(raw_value) -> list[dict]:
    if isinstance(raw_value, list):
        return [item for item in raw_value if isinstance(item, dict)]
    if not raw_value:
        return []
    if isinstance(raw_value, str):
        try:
            parsed = json.loads(raw_value)
        except json.JSONDecodeError:
            return []
        if isinstance(parsed, list):
            return [item for item in parsed if isinstance(item, dict)]
    return []

def _clean_text(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = remove_citations_clean(value).strip()
    return cleaned or None

def _build_flowchart_data(procedure_rows: list[dict]) -> dict:
    nodes: list[dict] = []
    links: list[dict] = []

    for procedure_row in procedure_rows:
        concept_id = str(procedure_row["concept_id"])
        procedure_title = procedure_row.get("concept_title") or "Untitled Procedure"
        procedure_purpose = _clean_text(procedure_row.get("purpose"))
        steps = _loads_json_list(procedure_row.get("steps"))

        if not steps:
            fallback_description = procedure_purpose or _clean_text(procedure_row.get("concept_description"))
            nodes.append({
                "id": f"{concept_id}:procedure",
                "title": procedure_title,
                "description": fallback_description,
                "concept_type": "procedure",
                "difficulty_level": procedure_row.get("difficulty_level"),
                "keywords": [],
            })
            continue

        previous_step_id: str | None = None
        for index, step in enumerate(steps, start = 1):
            action = (step.get("action") or "").strip()
            detail = _clean_text(step.get("detail"))
            expected_result = _clean_text(step.get("expected_result"))

            title = action or f"{procedure_title} - Step {index}"
            description_parts = [part for part in (
                f"Procedure: {procedure_title}",
                detail,
                f"Expected result: {expected_result}" if expected_result else None,
                procedure_purpose if index == 1 else None,
            ) if part]

            step_id = f"{concept_id}:step:{index}"
            nodes.append({
                "id": step_id,
                "title": title,
                "description": "\n".join(description_parts) if description_parts else None,
                "concept_type": "procedure",
                "difficulty_level": procedure_row.get("difficulty_level"),
                "keywords": [],
            })

            if previous_step_id:
                links.append({
                    "id": f"{previous_step_id}->{step_id}",
                    "sourceId": previous_step_id,
                    "targetId": step_id,
                    "relationship_type": "next_step",
                    "strength": 1.0,
                })
            previous_step_id = step_id

    return {"nodes": nodes, "links": links}


def _build_timeline_data(path_entries: list[dict]) -> dict:
    nodes: list[dict] = []
    links: list[dict] = []

    for entry in path_entries:
        path = entry["path"]
        steps = entry["steps"]
        path_title = path.get("title") or path.get("target_concept_title") or "Learning Path"

        if not steps:
            description_parts = [part for part in (
                path.get("description"),
                f"Target concept: {path.get('target_concept_title')}" if path.get("target_concept_title") else None,
            ) if part]
            nodes.append({
                "id": f"path:{path['id']}",
                "title": path_title,
                "description": "\n".join(description_parts) if description_parts else None,
                "concept_type": "learning_object",
                "difficulty_level": None,
                "keywords": [],
            })
            continue

        previous_step_id: str | None = None
        for step in steps:
            concept_id = str(step["concept_id"])
            step_order = step.get("step_order") or 0
            step_id = f"{path['id']}:{concept_id}:{step_order}"
            notes = _clean_text(step.get("notes"))
            concept_description = _clean_text(step.get("concept_description"))
            estimated_time = step.get("estimated_time_minutes")

            description_parts = [part for part in (
                f"Path: {path_title}",
                notes,
                concept_description,
                f"Estimated time: {estimated_time} minutes" if estimated_time else None,
            ) if part]

            nodes.append({
                "id": step_id,
                "title": step.get("concept_title") or f"Step {step_order}",
                "description": "\n".join(description_parts) if description_parts else None,
                "concept_type": step.get("concept_type") or "learning_object",
                "difficulty_level": step.get("difficulty_level"),
                "keywords": [],
            })

            if previous_step_id:
                links.append({
                    "id": f"{previous_step_id}->{step_id}",
                    "sourceId": previous_step_id,
                    "targetId": step_id,
                    "relationship_type": "prerequisite_of",
                    "strength": 1.0,
                })
            previous_step_id = step_id

    return {"nodes": nodes, "links": links}

@router.get("")
async def list_diagrams(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge = 1, le = 100),
    diagram_type: Optional[str] = Query(None),
    db=Depends(get_postgres),
    current_user=Depends(get_current_user)):

    user_id = UUID(str(current_user["id"]))
    repo = DiagramRepository(db)

    rows, total = await repo.list_by_user(
        user_id, diagram_type = diagram_type, page = page, page_size = page_size)

    diagrams = [_serialize_row(r) for r in rows]

    return {
        "diagrams": diagrams,
        "total": total,
        "page": page,
        "page_size": page_size}

@router.get("/recent")
async def recent_diagrams(
    limit: int = Query(5, ge=1, le=10),
    db = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    user_id = UUID(str(current_user["id"]))
    repo = DiagramRepository(db)

    rows = await repo.get_recent(user_id, limit=limit)
    diagrams = [_serialize_row(r) for r in rows]

    return {"diagrams": diagrams}

@router.post("/generate", status_code = status.HTTP_201_CREATED)
async def generate_diagram(
    payload: GenerateDiagramRequest,
    db = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    user_id = UUID(str(current_user["id"]))
    diagram_repo = DiagramRepository(db)
    concept_repo = ConceptRepository(db)
    learning_path_repo = LearningPathRepository(db)
    procedure_repo = ProcedureRepository(db)

    layout_map = {
        "knowledge_map": "3d_force",
        "flowchart": "2d_flow",
        "mindmap": "2d_tree",
        "timeline": "2d_timeline"}
    layout_type = layout_map.get(payload.diagram_type, "3d_force")

    if payload.diagram_type == "timeline":
        if not payload.learning_path_ids:
            raise HTTPException(
                status_code = status.HTTP_400_BAD_REQUEST,
                detail = "Timeline diagrams must be generated from one or more learning paths."
            )

        path_entries = []
        for path_id in payload.learning_path_ids:
            path_with_steps = await learning_path_repo.get_path_with_steps(path_id)
            if not path_with_steps:
                continue
            path_owner = path_with_steps["path"].get("created_by")
            if path_owner and UUID(str(path_owner)) != user_id:
                continue
            path_entries.append(path_with_steps)

        if not path_entries:
            raise HTTPException(
                status_code = status.HTTP_400_BAD_REQUEST,
                detail = "No usable learning paths were found for the selected timeline sources."
            )

        diagram_data = _build_timeline_data(path_entries)
        row = await diagram_repo.create(
            user_id = user_id,
            title = payload.title,
            diagram_type = payload.diagram_type,
            diagram_data = diagram_data,
            layout_type = layout_type,
            node_count = len(diagram_data["nodes"]),
            link_count = len(diagram_data["links"]),
            source_document_ids = None,
            source_concept_ids = None)

        return {
            "id": str(row["id"]),
            "url_slug": row["url_slug"],
            "title": row["title"],
            "diagram_type": row["diagram_type"],
            "node_count": row["node_count"],
            "link_count": row["link_count"],
            "created_at": row["created_at"]}

    if payload.diagram_type == "flowchart":
        if payload.subject_id:
            concepts = await concept_repo.get_by_subject(payload.subject_id, user_id)
        elif payload.document_ids:
            concepts = await concept_repo.get_by_documents(payload.document_ids, user_id)
        elif payload.concept_ids:
            concepts = await concept_repo.get_by_ids(payload.concept_ids)
        else:
            raise HTTPException(
                status_code = status.HTTP_400_BAD_REQUEST,
                detail = "Flowcharts must be generated from selected documents or procedure concepts."
            )

        procedure_concepts = [c for c in concepts if (c.get("concept_type") or "") == "procedure"]
        if not procedure_concepts:
            raise HTTPException(
                status_code = status.HTTP_400_BAD_REQUEST,
                detail = "No procedure concepts were found in the selected flowchart sources."
            )

        procedure_rows = []
        for concept in procedure_concepts:
            procedure_row = await procedure_repo.get_by_id(concept["id"])
            if procedure_row:
                procedure_rows.append(dict(procedure_row))
            else:
                procedure_rows.append({
                    "concept_id": concept["id"],
                    "concept_title": concept.get("title"),
                    "concept_description": concept.get("description"),
                    "difficulty_level": concept.get("difficulty_level"),
                    "purpose": None,
                    "steps": [],
                })

        if not procedure_rows:
            raise HTTPException(
                status_code = status.HTTP_400_BAD_REQUEST,
                detail = "No usable procedures were found for the selected flowchart sources."
            )

        diagram_data = _build_flowchart_data(procedure_rows)
        row = await diagram_repo.create(
            user_id = user_id,
            title = payload.title,
            diagram_type = payload.diagram_type,
            diagram_data = diagram_data,
            layout_type = layout_type,
            node_count = len(diagram_data["nodes"]),
            link_count = len(diagram_data["links"]),
            source_document_ids = payload.document_ids if payload.document_ids else None,
            source_concept_ids = [c["id"] for c in procedure_concepts] if procedure_concepts else None)

        return {
            "id": str(row["id"]),
            "url_slug": row["url_slug"],
            "title": row["title"],
            "diagram_type": row["diagram_type"],
            "node_count": row["node_count"],
            "link_count": row["link_count"],
            "created_at": row["created_at"]}

    if payload.concept_ids:
        concepts = await concept_repo.get_by_ids(payload.concept_ids)
        concept_ids = [c["id"] for c in concepts]
        doc_ids = payload.document_ids or []

        if payload.expand and concept_ids:
            if payload.diagram_type == "timeline":
                allowed = list(TEMPORAL_TYPES)
                bidir = []
            else:
                allowed = list(DOWNWARD_TYPES)
                if payload.include_lateral:
                    allowed += list(LATERAL_TYPES) + list(TEMPORAL_TYPES)
                    allowed.append('custom')
                if payload.include_upward:
                    allowed += list(UPWARD_TYPES)
                bidir = list(BIDIRECTIONAL_TYPES) if payload.include_lateral else []

            expanded_str_ids = await neo4j_repository.expand_concepts(
                seed_ids = [str(cid) for cid in concept_ids],
                depth = payload.expand_depth,
                allowed_rel_types = allowed,
                bidirectional_types = bidir)

            if len(expanded_str_ids) > len(concept_ids):
                if payload.include_upward:
                    seed_strs = {str(cid) for cid in concept_ids}
                    seed_tax = await neo4j_repository.get_taxonomy_for_concepts(list(seed_strs))
                    seed_lcc_codes = {t["lcc_code"] for t in seed_tax}

                    if seed_lcc_codes:
                        expanded_tax = await neo4j_repository.get_taxonomy_for_concepts(expanded_str_ids)
                        valid_ids = {t["concept_id"] for t in expanded_tax if t["lcc_code"] in seed_lcc_codes}
                        expanded_str_ids = [
                            sid for sid in expanded_str_ids
                            if sid in seed_strs or sid in valid_ids]

                expanded_uuids = [UUID(sid) for sid in expanded_str_ids]
                concepts = await concept_repo.get_by_ids(expanded_uuids)
                concept_ids = [c["id"] for c in concepts]

    elif payload.subject_id:
        concepts = await concept_repo.get_by_subject(payload.subject_id, user_id)
        concept_ids = [c["id"] for c in concepts]
        doc_ids = payload.document_ids or []

    elif payload.document_ids:
        concepts = await concept_repo.get_by_documents(payload.document_ids, user_id)
        concept_ids = [c["id"] for c in concepts]
        doc_ids = payload.document_ids

    else:
        concepts = await concept_repo.get_all_for_user(user_id)
        concept_ids = [c["id"] for c in concepts]
        doc_ids = []

    if not concept_ids:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "No concepts found for the selected sources")

    concept_id_strs = [str(cid) for cid in concept_ids]
    logger.info(f"Fetching Neo4j relationships for {len(concept_id_strs)} concepts")
    neo4j_rels = await neo4j_repository.get_relationships_between(concept_id_strs)
    logger.info(f"Neo4j returned {len(neo4j_rels)} relationships")

    nodes = []
    for c in concepts:
        desc = c.get("description") or ""
        if desc:
            desc = remove_citations_clean(desc)
        node: dict = {
            "id": str(c["id"]),
            "title": c.get("title") or "Untitled",
            "description": desc or None,
            "concept_type": c.get("concept_type") or "definition",
            "difficulty_level": c.get("difficulty_level"),
            "keywords": c.get("keywords") or []}
        if c.get("relevance"):
            node["subject_relevance"] = c["relevance"]
        if c.get("module_key"):
            node["module_key"] = c["module_key"]
        nodes.append(node)

    links = []
    for i, r in enumerate(neo4j_rels):
        rel_type = r["relationship_type"].lower()
        links.append({
            "id": f"rel-{r['source_concept_id']}-{r['target_concept_id']}-{i}",
            "sourceId": r["source_concept_id"],
            "targetId": r["target_concept_id"],
            "relationship_type": rel_type,
            "strength": float(r["strength"]) if r.get("strength") else None})

    groups = []
    if payload.show_taxonomy and concept_ids:
        tax_data = await neo4j_repository.get_taxonomy_for_concepts(concept_id_strs)

        concept_id_set = set(concept_id_strs)
        group_map: dict[str, dict] = {}
        for td in tax_data:
            cid = td["concept_id"]
            if cid not in concept_id_set:
                continue
            lcc_code = td["lcc_code"]
            if lcc_code not in group_map:
                group_map[lcc_code] = {
                    "id": f"tax-{lcc_code}",
                    "label": td["lcc_label"],
                    "lcc_code": lcc_code,
                    "concept_ids": []}
            group_map[lcc_code]["concept_ids"].append(cid)

        groups = list(group_map.values())

    diagram_data: dict = {"nodes": nodes, "links": links}
    if groups:
        diagram_data["groups"] = groups

    row = await diagram_repo.create(
        user_id = user_id,
        title = payload.title,
        diagram_type = payload.diagram_type,
        diagram_data = diagram_data,
        layout_type = layout_type,
        node_count = len(nodes),
        link_count = len(links),
        source_document_ids = doc_ids if doc_ids else None,
        source_concept_ids = concept_ids if payload.concept_ids else None)

    return {
        "id": str(row["id"]),
        "url_slug": row["url_slug"],
        "title": row["title"],
        "diagram_type": row["diagram_type"],
        "node_count": row["node_count"],
        "link_count": row["link_count"],
        "created_at": row["created_at"]}

@router.get("/s/{slug}")
async def get_diagram_by_slug(
    slug: str,
    db = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    user_id = UUID(str(current_user["id"]))
    repo = DiagramRepository(db)

    row = await repo.get_by_slug(slug, user_id)
    if not row:
        raise HTTPException(status_code = 404, detail = "Diagram not found")

    await repo.touch_last_viewed(row["id"])
    return _serialize_row(row)

@router.get("/{diagram_id}")
async def get_diagram(
    diagram_id: UUID,
    db = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    user_id = UUID(str(current_user["id"]))
    repo = DiagramRepository(db)

    row = await repo.get_by_id(diagram_id, user_id)
    if not row:
        raise HTTPException(status_code = 404, detail = "Diagram not found")

    await repo.touch_last_viewed(diagram_id)
    return _serialize_row(row)

@router.put("/{diagram_id}")
async def update_diagram(
    diagram_id: UUID,
    payload: UpdateDiagramRequest,
    db = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    user_id = UUID(str(current_user["id"]))
    repo = DiagramRepository(db)

    row = await repo.update(
        diagram_id = diagram_id,
        user_id = user_id,
        title = payload.title,
        description = payload.description,
        diagram_data = payload.diagram_data,
        view_state = payload.view_state,
        is_edited = payload.is_edited)

    if not row:
        raise HTTPException(status_code = 404, detail = "Diagram not found")

    d = dict(row)
    d["id"] = str(d["id"])
    return d

@router.delete("/{diagram_id}", status_code = status.HTTP_204_NO_CONTENT)
async def delete_diagram(
    diagram_id: UUID,
    db = Depends(get_postgres),
    current_user = Depends(get_current_user)):

    user_id = UUID(str(current_user["id"]))
    repo = DiagramRepository(db)

    deleted = await repo.delete(diagram_id, user_id)
    if not deleted:
        raise HTTPException(status_code = 404, detail = "Diagram not found")

from dataclasses import dataclass, field
from typing import TypedDict, NotRequired
from uuid import UUID, uuid4
import logging

logger = logging.getLogger(__name__)

class NodeMetadata(TypedDict, total = False):

    output_text: NotRequired[str]
    data: NotRequired[str]
    suggested_filename: NotRequired[str]
    page_number: NotRequired[int]

@dataclass
class ProcessorResult:

    success: bool
    output_text: str | None = None
    error: str | None = None
    confidence: float | None = None
    language: str | None = None

@dataclass
class ExtractionNode:

    id: UUID
    source_path: str
    document_type: str
    extraction_type: str
    parent_id: UUID | None = None
    children_ids: list[UUID] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)
    depth: int = 0

class ExtractionTree:

    def __init__(self):

        self.nodes: dict[UUID, ExtractionNode] = {}
        self.root_id: UUID | None = None

    def add_root(
        self,
        source_path: str,
        document_type: str,
        metadata: dict | None = None) -> UUID:
        
        node_id = uuid4()

        node = ExtractionNode(
            id = node_id,
            source_path = source_path,
            document_type = document_type,
            parent_id = None,
            extraction_type = "document",
            metadata = metadata or {},
            depth = 0)

        self.nodes[node_id] = node
        self.root_id = node_id
        logger.debug(f"Added root node: {source_path}")
        return node_id

    def add_child(
        self,
        parent_id: UUID,
        source_path: str,
        document_type: str,
        extraction_type: str,
        metadata: dict | None = None) -> UUID:

        if parent_id not in self.nodes:
            raise ValueError(f"Parent node {parent_id} not found")

        parent = self.nodes[parent_id]
        child_id = uuid4()

        child = ExtractionNode(
            id = child_id,
            source_path = source_path,
            document_type = document_type,
            extraction_type = extraction_type,
            parent_id = parent_id,
            metadata = metadata or {},
            depth = parent.depth + 1)

        self.nodes[child_id] = child
        parent.children_ids.append(child_id)
        logger.debug(f"Added child node: {source_path} (parent: {parent.source_path})")
        return child_id

    def get_node(self, node_id: UUID) -> ExtractionNode | None:
        return self.nodes.get(node_id)

    def get_children(self, node_id: UUID) -> list[ExtractionNode]:

        node = self.nodes.get(node_id)

        if not node:
            return []
        
        return [self.nodes[child_id] for child_id in node.children_ids if child_id in self.nodes]

    def get_ancestry_path(self, node_id: UUID) -> list[ExtractionNode]:

        path = []
        node = self.nodes.get(node_id)

        if not node:
            return path

        while node:
            path.insert(0, node)
            if node.parent_id:
                node = self.nodes.get(node.parent_id)
            else:
                break

        return path

    def to_dict(self) -> dict:

        return {
            "root_id": str(self.root_id) if self.root_id else None,
            "nodes": {
                str(node_id): {
                    "id": str(node.id),
                    "source_path": node.source_path,
                    "document_type": node.document_type,
                    "extraction_type": node.extraction_type,
                    "parent_id": str(node.parent_id) if node.parent_id else None,
                    "children_ids": [str(child_id) for child_id in node.children_ids],
                    "metadata": node.metadata,
                    "depth": node.depth}
                for node_id, node in self.nodes.items()}}

    @classmethod
    def from_dict(cls, data: dict) -> "ExtractionTree":

        tree = cls()
        tree.root_id = UUID(data["root_id"]) if data.get("root_id") else None

        for node_data in data.get("nodes", {}).values():
            node = ExtractionNode(
                id = UUID(node_data["id"]),
                source_path = node_data["source_path"],
                document_type = node_data["document_type"],
                extraction_type = node_data.get("extraction_type", "document"),
                parent_id = UUID(node_data["parent_id"]) if node_data.get("parent_id") else None,
                children_ids = [UUID(cid) for cid in node_data.get("children_ids", [])],
                metadata = node_data.get("metadata", {}),
                depth = node_data.get("depth", 0))
            tree.nodes[node.id] = node

        return tree

@dataclass
class ExtractionResult:
    tree: ExtractionTree
    metadata: dict = field(default_factory = dict)
    subject_hints: dict[UUID, dict] = field(default_factory = dict)

    def set_subject_hints(self, node_id: UUID, hints: dict):

        self.subject_hints[node_id] = hints
        logger.debug(f"Set subject hints for node {node_id}: {hints}")

    def get_subject_hints(self, node_id: UUID) -> dict | None:

        return self.subject_hints.get(node_id)

    def get_inherited_hints(self, node_id: UUID) -> dict:

        merged_hints = {}
        ancestry = self.tree.get_ancestry_path(node_id)
        for ancestor in ancestry:
            if ancestor.id in self.subject_hints:
                for key, value in self.subject_hints[ancestor.id].items():
                    if key not in merged_hints:
                        merged_hints[key] = value
                    elif isinstance(value, list) and isinstance(merged_hints[key], list):
                        merged_hints[key] = list(set(merged_hints[key] + value))

        return merged_hints

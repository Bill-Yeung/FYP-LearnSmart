from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from enum import Enum


class RelationshipType(str, Enum):
    PART_OF = "part_of"
    HAS_PART = "has_part"
    CHARACTERISTIC_OF = "characteristic_of"
    HAS_CHARACTERISTIC = "has_characteristic"
    MEMBER_OF = "member_of"
    HAS_MEMBER = "has_member"
    HAS_SUBSEQUENCE = "has_subsequence"
    IS_SUBSEQUENCE_OF = "is_subsequence_of"
    PARTICIPATES_IN = "participates_in"
    PREREQUISITE_OF = "prerequisite_of"
    HAS_PREREQUISITE = "has_prerequisite"
    APPLIES_TO = "applies_to"
    APPLIED_IN = "applied_in"
    BUILDS_ON = "builds_on"
    EXEMPLIFIES = "exemplifies"
    DERIVES_FROM = "derives_from"
    AUTHOR = "author"
    INTRODUCED_BY = "introduced_by"
    SIMULTANEOUS_WITH = "simultaneous_with"
    HAPPENS_DURING = "happens_during"
    BEFORE_OR_SIMULTANEOUS_WITH = "before_or_simultaneous_with"
    STARTS_BEFORE = "starts_before"
    ENDS_AFTER = "ends_after"
    DERIVES_INTO = "derives_into"
    LOCATED_IN = "located_in"
    LOCATION_OF = "location_of"
    OVERLAPS = "overlaps"
    ADJACENT_TO = "adjacent_to"
    SURROUNDED_BY = "surrounded_by"
    CONNECTED_TO = "connected_to"
    CAUSALLY_RELATED_TO = "causally_related_to"
    REGULATES = "regulates"
    REGULATED_BY = "regulated_by"
    ENABLES = "enables"
    CONTRIBUTES_TO = "contributes_to"
    RESULTS_IN_ASSEMBLY_OF = "results_in_assembly_of"
    RESULTS_IN_BREAKDOWN_OF = "results_in_breakdown_of"
    CAPABLE_OF = "capable_of"
    INTERACTS_WITH = "interacts_with"
    HAS_PARTICIPANT = "has_participant"
    IMPLIES = "implies"
    CONTRADICTS = "contradicts"
    SIMILAR_TO = "similar_to"
    OWNS = "owns"
    IS_OWNED_BY = "is_owned_by"
    PRODUCES = "produces"
    PRODUCED_BY = "produced_by"
    DETERMINED_BY = "determined_by"
    DETERMINES = "determines"
    CORRELATED_WITH = "correlated_with"
    IMPLEMENTS = "implements"
    IMPLEMENTED_BY = "implemented_by"
    PROVES = "proves"
    PROVEN_BY = "proven_by"
    GENERALIZES = "generalizes"
    SPECIALIZED_BY = "specialized_by"
    APPROXIMATES = "approximates"
    APPROXIMATED_BY = "approximated_by"
    REPLACES = "replaces"
    REPLACED_BY = "replaced_by"
    CUSTOM = "custom"

class RelationshipDirection(str, Enum):
    UNIDIRECTIONAL = "unidirectional"
    BIDIRECTIONAL = "bidirectional"


class RelationshipCreate(BaseModel):
    source_concept_id: UUID
    target_concept_id: UUID
    relationship_type: str
    strength: float = Field(default = 1.0, ge = 0.0, le = 1.0)
    direction: RelationshipDirection = RelationshipDirection.UNIDIRECTIONAL

class RelatedConceptsRequest(BaseModel):
    concept_id: UUID
    max_distance: int = Field(default = 2, ge = 1, le = 5)
    relationship_types: list[str] | None = None


class RelationshipResponse(BaseModel):
    id: UUID
    relationship_type: str
    relationship_type_label: str | None
    direction: str
    strength: float
    source_concept_id: UUID
    target_concept_id: UUID
    source_title: str | None
    target_title: str | None
    created_at: datetime

    class Config:
        from_attributes = True

class ConceptRelationshipsResponse(BaseModel):
    concept_id: UUID
    concept_title: str
    outgoing_relationships: list[RelationshipResponse]
    incoming_relationships: list[RelationshipResponse]
    total_relationships: int

class RelatedConceptResponse(BaseModel):
    concept_id: UUID
    title: str
    description: str | None
    concept_type: str
    difficulty_level: str | None
    relationship_type: str
    distance: int
    strength: float

    class Config:
        from_attributes = True

class RelatedConceptsListResponse(BaseModel):
    source_concept_id: UUID
    source_concept_title: str
    max_distance: int
    related_concepts: list[RelatedConceptResponse]
    total_found: int

class RelationshipGraphResponse(BaseModel):
    nodes: list[dict]
    edges: list[dict]
    center_node_id: UUID

import asyncio
import json
import logging
import re
from dataclasses import dataclass
from enum import Enum
from typing import Optional, List, Dict, Any

from app.services.ai.provider import AIProvider
from app.services.ai.prompts import DEDUP_SYSTEM_PROMPT, DEDUP_USER_TEMPLATE

logger = logging.getLogger(__name__)

TITLE_KEY_STOPWORDS = {
    "a", "an", "the", "in", "on", "for", "to", "of", "with"
}


def normalize_concept_title(title: str) -> str:

    text = (title or "").strip()
    if not text:
        return ""

    text = text.replace("–", "-").replace("—", "-")
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\(\s+", "(", text)
    text = re.sub(r"\s+\)", ")", text)
    text = re.sub(r"\s+([,:;])", r"\1", text)
    text = re.sub(r"\s*-\s*", " - ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip(" -")


def canonicalize_concept_title(
    title: str,
    concept_type: str = "",
    description: str = "",
    keywords: Optional[List[str]] = None) -> str:

    text = normalize_concept_title(title)
    if not text:
        return ""

    key = concept_title_key(text)
    lower_text = text.casefold()
    keywords = keywords or []
    keyword_keys = {concept_title_key(keyword) for keyword in keywords if keyword}

    direct_map = {
        "computer vision definition": "Computer Vision",
        "computer vision sources": "Computer Vision Resources",
        "computer vision self study resources": "Computer Vision Self-Study Resources",
        "self study guide computer vision": "Computer Vision Self-Study Resources",
        "cv models": "Computer Vision Models",
        "detectron2 library": "Detectron2",
        "detectron2 package": "Detectron2",
        "detectron2 framework": "Detectron2",
        "face recognition": "Face Recognition",
        "facial recognition": "Face Recognition",
        "ocr model": "Optical Character Recognition (OCR)",
        "optical character recognition ocr model": "Optical Character Recognition (OCR)",
        "digital image numeric array": "Digital Image as Array of Pixel Values",
        "digital image array pixel values": "Digital Image as Array of Pixel Values",
        "opencv package characteristics": "OpenCV",
        "opencv package": "OpenCV",
    }

    if key in direct_map:
        return direct_map[key]

    if "haar cascade" in key and "face detection" in key:
        return "Haar Cascade Face Detection"

    if lower_text == "computer vision & ai cloud services":
        return "Computer Vision and AI Cloud Services"

    if "detectron2" in keyword_keys and key == "detectron2":
        return "Detectron2"

    if concept_type == "entity" and lower_text.endswith(" library"):
        return text[:-8].strip()

    return text


def concept_title_key(title: str) -> str:

    normalized = normalize_concept_title(title).casefold()
    normalized = normalized.replace("&", " and ")
    normalized = re.sub(r"[(){}\[\],:;.!?\"'`]+", " ", normalized)
    normalized = normalized.replace("/", " ")
    normalized = normalized.replace("-", " ")
    tokens = re.findall(r"[a-z0-9+]+", normalized)
    tokens = [token for token in tokens if token not in TITLE_KEY_STOPWORDS]
    return " ".join(tokens)

class DuplicateTier(Enum):
    EXACT = "exact"
    RELATED = "related"
    DIFFERENT = "different"

class MergeAction(Enum):
    MERGE = "merge"
    CREATE_WITH_RELATIONSHIP = "create_with_relationship"
    RENAME_EXISTING = "rename_existing"
    CREATE_NEW = "create_new"

@dataclass
class DuplicateCheckResult:
    tier: DuplicateTier
    similarity_score: float
    existing_concept_id: Optional[str] = None
    existing_concept_name: Optional[str] = None
    existing_concept_description: Optional[str] = None
    action: MergeAction = MergeAction.CREATE_NEW
    relationship_type: Optional[str] = None
    new_title: Optional[str] = None
    reason: Optional[str] = None

@dataclass
class DeduplicationStats:
    total_checked: int = 0
    exact_duplicates: int = 0
    semantic_duplicates: int = 0
    llm_merges: int = 0
    llm_relationships: int = 0
    unique_items: int = 0

RELATIONSHIP_TYPES = [
    # Structural
    "part_of", "has_part", "characteristic_of", "has_characteristic",
    "member_of", "has_member", "has_subsequence", "is_subsequence_of", "participates_in",
    # Educational
    "prerequisite_of", "has_prerequisite",
    "applies_to", "applied_in", "builds_on", "exemplifies", "derives_from",
    # Attribution
    "author", "introduced_by",
    # Temporal
    "simultaneous_with", "happens_during", "before_or_simultaneous_with",
    "starts_before", "ends_after", "derives_into",
    # Spatial
    "located_in", "location_of", "overlaps",
    "adjacent_to", "surrounded_by", "connected_to",
    # Causal
    "causally_related_to", "regulates", "regulated_by", "enables",
    "contributes_to", "results_in_assembly_of", "results_in_breakdown_of",
    "capable_of", "interacts_with", "has_participant",
    # Logical
    "implies", "contradicts", "similar_to",
    "owns", "is_owned_by", "produces", "produced_by", "determined_by", "determines",
    "correlated_with",
    # Technical
    "implements", "implemented_by",
    "proves", "proven_by", "generalizes", "specialized_by", "approximates", "approximated_by",
    "replaces", "replaced_by",
    # Fallback
    "custom"
]

class DeduplicationService:

    EXACT_THRESHOLD = 0.92
    RELATED_THRESHOLD = 0.82

    def __init__(self, ai_provider: Optional[AIProvider] = None):

        self.ai_provider = ai_provider or AIProvider()
        self.stats = DeduplicationStats()

    def get_tier(self, similarity_score: float) -> DuplicateTier:

        if similarity_score >= self.EXACT_THRESHOLD:
            return DuplicateTier.EXACT
        elif similarity_score >= self.RELATED_THRESHOLD:
            return DuplicateTier.RELATED
        else:
            return DuplicateTier.DIFFERENT

    async def check_duplicate(
        self,
        new_concept: Dict[str, Any],
        similar_concepts: List[Dict[str, Any]]) -> DuplicateCheckResult:
       
        self.stats.total_checked += 1

        if not similar_concepts:
            self.stats.unique_items += 1
            return DuplicateCheckResult(
                tier = DuplicateTier.DIFFERENT,
                similarity_score = 0.0,
                action = MergeAction.CREATE_NEW)

        best_match = similar_concepts[0]
        score = best_match.get("similarity_score", 0.0)
        tier = self.get_tier(score)

        result = DuplicateCheckResult(
            tier = tier,
            similarity_score = score,
            existing_concept_id = best_match.get("concept_id"),
            existing_concept_name = best_match.get("name"),
            existing_concept_description = best_match.get("description"))

        if tier == DuplicateTier.EXACT:

            self.stats.exact_duplicates += 1
            result.action = MergeAction.MERGE
            result.reason = f"Exact match (score: {score:.3f})"

        elif tier == DuplicateTier.RELATED:

            self.stats.semantic_duplicates += 1
            llm_decision = await self._llm_decide_action(new_concept, best_match)
            result.action = llm_decision["action"]
            result.relationship_type = llm_decision.get("relationship_type")
            result.new_title = llm_decision.get("new_title")
            result.reason = llm_decision.get("reason")

            if result.action == MergeAction.MERGE:
                self.stats.llm_merges += 1
            elif result.action == MergeAction.CREATE_WITH_RELATIONSHIP:
                self.stats.llm_relationships += 1

        else:

            self.stats.unique_items += 1
            result.action = MergeAction.CREATE_NEW
            result.reason = f"Low similarity (score: {score:.3f})"

        return result

    async def _llm_decide_action(
        self,
        new_concept: Dict[str, Any],
        existing_concept: Dict[str, Any]) -> Dict[str, Any]:

        base_prompt = DEDUP_USER_TEMPLATE.format(
            new_term=new_concept.get("term", ""),
            new_description=new_concept.get("description", ""),
            new_keywords=", ".join(new_concept.get("keywords", [])),
            existing_name=existing_concept.get("name", ""),
            existing_description=existing_concept.get("description", ""))

        max_retries = 3
        last_error = None

        for attempt in range(max_retries):

            try:

                if last_error and attempt > 0:
                    user_prompt = (
                        f"{base_prompt}\n\n"
                        f"IMPORTANT: Your previous response had an error: {last_error}\n"
                        f"Please fix this and return valid JSON.")
                else:
                    user_prompt = base_prompt

                async with self.ai_provider.session(system_prompt=DEDUP_SYSTEM_PROMPT) as s:
                    response = await self.ai_provider.generate(
                        prompt = user_prompt,
                        session = s,
                        temperature = 0.3,
                        max_tokens = 200)

                if not response:
                    last_error = "Empty response"
                    continue

                response = response.strip()
                if response.startswith("```"):
                    lines = response.split("\n")
                    response = "\n".join(lines[1:-1]) if len(lines) > 2 else response
                    if response.startswith("json"):
                        response = response[4:].strip()

                decision = json.loads(response)

                action_str = decision.get("action", "create_new")
                try:
                    action = MergeAction(action_str)
                except ValueError:
                    last_error = f"Invalid action: '{action_str}'"
                    continue

                rel_type = decision.get("relationship_type")
                if rel_type and rel_type not in RELATIONSHIP_TYPES:
                    rel_type = "custom"

                return {
                    "action": action,
                    "relationship_type": rel_type if action == MergeAction.CREATE_WITH_RELATIONSHIP else None,
                    "new_title": decision.get("new_title") if action == MergeAction.RENAME_EXISTING else None,
                    "reason": decision.get("reason", "LLM decision")}

            except Exception as e:
                last_error = str(e)
                logger.error(f"Dedup LLM attempt {attempt + 1} failed: {e}")

            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)

        logger.error(f"Dedup LLM failed after {max_retries} attempts: {last_error}")
        return {
            "action": MergeAction.CREATE_NEW,
            "reason": f"LLM failed: {last_error}"}

    def get_stats(self) -> Dict[str, Any]:

        return {
            "total_checked": self.stats.total_checked,
            "exact_duplicates": self.stats.exact_duplicates,
            "semantic_duplicates": self.stats.semantic_duplicates,
            "llm_merges": self.stats.llm_merges,
            "llm_relationships": self.stats.llm_relationships,
            "unique_items": self.stats.unique_items,
            "thresholds": {
                "exact": self.EXACT_THRESHOLD,
                "related": self.RELATED_THRESHOLD}}

    def reset_stats(self):
        self.stats = DeduplicationStats()

# Global instance
deduplication_service = DeduplicationService()

import json
import logging

from app.services.ai.provider import ai_provider
from app.services.ai.prompts import (
    CHALLENGE_SCORING_SYSTEM_PROMPT,
    CHALLENGE_SCORING_USER_PROMPT,
)

logger = logging.getLogger(__name__)

DEFAULT_CRITERIA = [
    {"name": "Relevance", "description": "How well the submission addresses the challenge topic", "weight": 25},
    {"name": "Quality", "description": "Overall quality, depth, and thoroughness", "weight": 25},
    {"name": "Clarity", "description": "How clear and well-structured the submission is", "weight": 25},
    {"name": "Creativity", "description": "Originality and creative approach", "weight": 25},
]

async def score_submission(
    challenge_title: str,
    challenge_description: str | None,
    challenge_instructions: str | None,
    challenge_type: str,
    judging_criteria: list[dict] | None,
    submission_title: str,
    submission_description: str | None,
) -> dict:
    
    criteria = judging_criteria if judging_criteria else DEFAULT_CRITERIA

    criteria_text = "\n".join(
        f"- {c['name']} (weight: {c['weight']}%): {c.get('description', '')}"
        for c in criteria
    )

    prompt = CHALLENGE_SCORING_USER_PROMPT.format(
        challenge_title=challenge_title,
        challenge_type=challenge_type,
        challenge_description=challenge_description or "N/A",
        challenge_instructions=challenge_instructions or "N/A",
        criteria_text=criteria_text,
        submission_title=submission_title,
        submission_description=submission_description or "No description provided",
    )

    try:
        async with ai_provider.session(system_prompt=CHALLENGE_SCORING_SYSTEM_PROMPT) as session:
            raw = await ai_provider.generate(
                prompt=prompt,
                session=session,
                temperature=0.3,
                max_tokens=500,
                json_mode=True,
            )

        content = raw.strip()

        if content.startswith("```"):
            content = content.split("\n", 1)[1] if "\n" in content else content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

        result = json.loads(content)
        scores = result.get("scores", {})
        feedback = result.get("feedback", "")

        total_weight = sum(c["weight"] for c in criteria)
        final_score = 0.0
        for c in criteria:
            criterion_score = scores.get(c["name"], 50)
            final_score += criterion_score * (c["weight"] / total_weight)

        final_score = round(final_score, 2)

        return {
            "scores": scores,
            "final_score": final_score,
            "feedback": feedback,
        }

    except Exception:
        logger.exception("AI scoring failed, falling back to deterministic score")
        return _deterministic_score(criteria)

def _deterministic_score(criteria: list[dict]) -> dict:

    scores = {c["name"]: 0 for c in criteria}
    return {
        "scores": scores,
        "final_score": 0.0,
        "feedback": "AI scoring is currently unavailable. This submission will need to be reviewed manually.",
    }

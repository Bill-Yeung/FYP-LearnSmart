import json
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, patch

import pytest

from app.services.ai.challenge_scorer import (
    DEFAULT_CRITERIA,
    _deterministic_score,
    score_submission,
)

class TestDeterministicScore:

    def test_returns_zero_for_each_criterion(self):
        criteria = [
            {"name": "Relevance", "weight": 50},
            {"name": "Quality", "weight": 50},
        ]
        result = _deterministic_score(criteria)

        assert result["scores"] == {"Relevance": 0, "Quality": 0}
        assert result["final_score"] == 0.0

    def test_includes_manual_review_feedback_message(self):
        result = _deterministic_score(DEFAULT_CRITERIA)
        assert "manually" in result["feedback"].lower()

    def test_handles_single_criterion(self):
        result = _deterministic_score([{"name": "Only", "weight": 100}])
        assert result["scores"] == {"Only": 0}
        assert result["final_score"] == 0.0

    def test_handles_empty_criteria_list(self):
        result = _deterministic_score([])
        assert result["scores"] == {}
        assert result["final_score"] == 0.0

    def test_default_criteria_has_four_dimensions_summing_to_100(self):
        assert len(DEFAULT_CRITERIA) == 4
        assert sum(c["weight"] for c in DEFAULT_CRITERIA) == 100

def _mock_ai_provider(json_payload: dict):

    @asynccontextmanager
    async def fake_session(system_prompt=None):
        yield object()

    mock = AsyncMock()
    mock.session = fake_session
    mock.generate = AsyncMock(return_value=json.dumps(json_payload))
    return mock

@pytest.mark.asyncio
class TestScoreSubmissionWeighting:

    async def test_equal_weights_compute_simple_average(self):
        criteria = [
            {"name": "A", "description": "a", "weight": 50},
            {"name": "B", "description": "b", "weight": 50},
        ]
        payload = {"scores": {"A": 80, "B": 60}, "feedback": "ok"}
        with patch(
            "app.services.ai.challenge_scorer.ai_provider",
            _mock_ai_provider(payload),
        ):
            result = await score_submission(
                challenge_title="T",
                challenge_description=None,
                challenge_instructions=None,
                challenge_type="essay",
                judging_criteria=criteria,
                submission_title="s",
                submission_description=None,
            )

        assert result["scores"] == {"A": 80, "B": 60}
        assert result["final_score"] == 70.0
        assert result["feedback"] == "ok"

    async def test_uneven_weights_apply_correctly(self):
        criteria = [
            {"name": "A", "description": "", "weight": 75},
            {"name": "B", "description": "", "weight": 25},
        ]
        payload = {"scores": {"A": 100, "B": 0}, "feedback": ""}
        with patch(
            "app.services.ai.challenge_scorer.ai_provider",
            _mock_ai_provider(payload),
        ):
            result = await score_submission(
                "T", None, None, "essay", criteria, "s", None,
            )

        assert result["final_score"] == 75.0

    async def test_missing_score_defaults_to_fifty(self):
        criteria = [{"name": "A", "description": "", "weight": 100}]
        payload = {"scores": {}, "feedback": ""}
        with patch(
            "app.services.ai.challenge_scorer.ai_provider",
            _mock_ai_provider(payload),
        ):
            result = await score_submission(
                "T", None, None, "essay", criteria, "s", None,
            )
        assert result["final_score"] == 50.0

    async def test_strips_markdown_code_fences_from_ai_response(self):
        criteria = [{"name": "A", "description": "", "weight": 100}]
        fenced = "```json\n" + json.dumps({"scores": {"A": 90}, "feedback": "x"}) + "\n```"

        @asynccontextmanager
        async def fake_session(system_prompt=None):
            yield object()

        mock = AsyncMock()
        mock.session = fake_session
        mock.generate = AsyncMock(return_value=fenced)

        with patch("app.services.ai.challenge_scorer.ai_provider", mock):
            result = await score_submission(
                "T", None, None, "essay", criteria, "s", None,
            )
        assert result["final_score"] == 90.0
        assert result["feedback"] == "x"

    async def test_falls_back_to_deterministic_score_on_ai_error(self):
        criteria = [{"name": "A", "description": "", "weight": 100}]

        @asynccontextmanager
        async def fake_session(system_prompt=None):
            yield object()

        mock = AsyncMock()
        mock.session = fake_session
        mock.generate = AsyncMock(side_effect=RuntimeError("provider down"))

        with patch("app.services.ai.challenge_scorer.ai_provider", mock):
            result = await score_submission(
                "T", None, None, "essay", criteria, "s", None,
            )
        assert result["final_score"] == 0.0
        assert result["scores"] == {"A": 0}
        assert "manually" in result["feedback"].lower()

    async def test_uses_default_criteria_when_none_provided(self):
        payload = {
            "scores": {c["name"]: 80 for c in DEFAULT_CRITERIA},
            "feedback": "good",
        }
        with patch(
            "app.services.ai.challenge_scorer.ai_provider",
            _mock_ai_provider(payload),
        ):
            result = await score_submission(
                "T", None, None, "essay", None, "s", None,
            )
        assert result["final_score"] == 80.0

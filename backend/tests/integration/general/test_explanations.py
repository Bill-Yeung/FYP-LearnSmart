import json
from contextlib import asynccontextmanager

import pytest
from httpx import ASGITransport, AsyncClient

import app.api.explanations as explanations_api
from app.services.ai.provider import AIProviderError
from main import app

def install_fake_ai(monkeypatch, *, raw_text: str | None = None, error: Exception | None = None):
    class FakeAIProvider:
        @asynccontextmanager
        async def session(self, system_prompt=None):
            yield object()

        async def generate(self, prompt, session, temperature, max_tokens):
            if error is not None:
                raise error
            return raw_text or ""

    monkeypatch.setattr(explanations_api, "AIProvider", FakeAIProvider)

@pytest.mark.asyncio
async def test_simplify_explanation_strips_markdown_fences(monkeypatch):
    install_fake_ai(monkeypatch, raw_text="```text\nSimplified explanation for grade 9.\n```")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/explanations/simplify",
            json={
                "explanation": "Cellular respiration converts glucose into ATP.",
                "targetGradeLevel": "9",
            },
        )

    assert response.status_code == 200
    assert response.json() == {"simplified": "Simplified explanation for grade 9."}

@pytest.mark.asyncio
async def test_check_understanding_rejects_blank_explanation():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/explanations/check-understanding",
            json={"explanation": "   ", "concept": "Photosynthesis"},
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "Explanation cannot be empty"

@pytest.mark.asyncio
async def test_check_understanding_parses_ai_json_and_defaults_missing_fields(monkeypatch):
    raw = """```json
    {
      "flagged": [
        {
          "phrase": "plants eat sunlight",
          "issue": "Incorrect mechanism",
          "severity": "major",
          "fix": "Plants convert light into chemical energy"
        }
      ],
      "styleSuggestions": [
        {
          "message": "Define chlorophyll more precisely"
        }
      ],
      "verdict": "needs_clarification",
      "confidence": "71"
    }
    ```"""
    install_fake_ai(monkeypatch, raw_text=raw)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/explanations/check-understanding",
            json={
                "explanation": "Plants eat sunlight to make food.",
                "concept": "Photosynthesis",
                "strictness": "strict",
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["verdict"] == "needs_clarification"
    assert payload["confidence"] == 71.0
    assert payload["flagged"] == [
        {
            "phrase": "plants eat sunlight",
            "issue": "Incorrect mechanism",
            "severity": "major",
            "fix": "Plants convert light into chemical energy",
        }
    ]
    assert payload["styleSuggestions"] == [
        {"phrase": None, "suggestion": "Define chlorophyll more precisely"}
    ]
    assert payload["follow_up_questions"] is None

@pytest.mark.asyncio
async def test_check_understanding_uses_safe_defaults_when_ai_output_is_not_json(monkeypatch):
    install_fake_ai(monkeypatch, raw_text="not valid json at all")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/explanations/check-understanding",
            json={
                "explanation": "Energy is stored somehow.",
                "concept": "Photosynthesis",
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["original"] == "Energy is stored somehow."
    assert payload["flagged"] == []
    assert payload["styleSuggestions"] == []
    assert payload["verdict"] == "clear"
    assert payload["confidence"] == 86.0

@pytest.mark.asyncio
async def test_reflection_teaching_coerces_confidence_and_fills_missing_lists(monkeypatch):
    raw = json.dumps(
        {
            "strengths": ["Named the main process"],
            "confidence_level": "82%",
        }
    )
    install_fake_ai(monkeypatch, raw_text=raw)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/explanations/reflect",
            json={
                "explanation": "Photosynthesis uses light to make glucose.",
                "concept": "Photosynthesis",
                "target_level": "intermediate",
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["analysis"]["strengths"] == ["Named the main process"]
    assert payload["analysis"]["areas_for_improvement"] == ["Could provide more detail"]
    assert payload["analysis"]["reflection_questions"] == [
        "Can you explain this in simpler terms?",
        "What examples come to mind?",
    ]
    assert payload["analysis"]["suggested_resources"] == [
        "Review foundational materials on this topic"
    ]
    assert payload["analysis"]["confidence_level"] == 82.0

@pytest.mark.asyncio
async def test_reflection_teaching_falls_back_when_ai_payload_is_unusable(monkeypatch):
    install_fake_ai(monkeypatch, raw_text='{"confidence_level":"not-a-number"}')

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/explanations/reflect",
            json={
                "explanation": "A vague explanation.",
                "concept": "Entropy",
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["analysis"]["confidence_level"] == 55.0
    assert payload["analysis"]["strengths"] == ["Showed effort in attempting to explain"]
    assert payload["analysis"]["areas_for_improvement"] == [
        "More specific examples needed",
        "Clarify technical terminology",
    ]

@pytest.mark.asyncio
async def test_simplify_explanation_returns_502_when_provider_fails(monkeypatch):
    install_fake_ai(monkeypatch, error=AIProviderError("provider failed"))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/explanations/simplify",
            json={
                "explanation": "Cellular respiration converts glucose into ATP.",
                "targetGradeLevel": "9",
            },
        )

    assert response.status_code == 502
    assert response.json()["detail"] == "Failed to simplify explanation"

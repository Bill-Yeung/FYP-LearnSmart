import json
from datetime import datetime, timezone

from app.api.challenges import _format_challenge

def _base_row() -> dict:
    return {
        "id": "11111111-1111-1111-1111-111111111111",
        "title": "Build a GraphRAG demo",
        "description": "Show off the knowledge graph",
        "instructions": "Submit a short writeup",
        "challenge_type": "writeup",
        "status": "active",
        "starts_at": datetime(2026, 4, 1, 9, 0, 0),
        "ends_at": datetime(2026, 4, 30, 23, 59, 0),
        "max_participants": 50,
        "participant_count": 7,
        "submission_count": 3,
        "rewards": None,
        "judging_criteria": None,
        "created_at": datetime(2026, 3, 28, 12, 0, 0),
        "community_id": "22222222-2222-2222-2222-222222222222",
        "community_name": "GraphRAG Builders",
    }

class TestFormatChallengeBasics:

    def test_serialises_datetimes_to_iso(self):
        out = _format_challenge(_base_row())
        assert out["starts_at"] == "2026-04-01T09:00:00"
        assert out["ends_at"] == "2026-04-30T23:59:00"
        assert out["created_at"] == "2026-03-28T12:00:00"

    def test_id_is_stringified(self):
        out = _format_challenge(_base_row())
        assert isinstance(out["id"], str)
        assert out["id"] == "11111111-1111-1111-1111-111111111111"

    def test_default_counts_when_missing(self):
        row = _base_row()
        del row["participant_count"]
        del row["submission_count"]
        out = _format_challenge(row)
        assert out["participant_count"] == 0
        assert out["submission_count"] == 0

    def test_handles_none_datetimes(self):
        row = _base_row()
        row["starts_at"] = None
        row["ends_at"] = None
        row["created_at"] = None
        out = _format_challenge(row)
        assert out["starts_at"] is None
        assert out["ends_at"] is None
        assert out["created_at"] is None

class TestFormatChallengeJsonFields:

    def test_parses_rewards_json_string(self):
        row = _base_row()
        row["rewards"] = json.dumps({"winner_points": 100, "participant_points": 10})
        out = _format_challenge(row)
        assert out["rewards"] == {"winner_points": 100, "participant_points": 10}

    def test_passes_through_rewards_dict_untouched(self):
        row = _base_row()
        row["rewards"] = {"winner_points": 200}
        out = _format_challenge(row)
        assert out["rewards"] == {"winner_points": 200}

    def test_parses_judging_criteria_json_string(self):
        row = _base_row()
        row["judging_criteria"] = json.dumps([{"name": "Quality", "weight": 100}])
        out = _format_challenge(row)
        assert out["judging_criteria"] == [{"name": "Quality", "weight": 100}]

    def test_keeps_none_for_missing_json_fields(self):
        out = _format_challenge(_base_row())
        assert out["rewards"] is None
        assert out["judging_criteria"] is None

class TestFormatChallengeCommunityAndUserContext:

    def test_attaches_community_block_when_name_present(self):
        out = _format_challenge(_base_row())
        assert out["community"] == {
            "id": "22222222-2222-2222-2222-222222222222",
            "name": "GraphRAG Builders",
        }

    def test_omits_community_block_when_no_name(self):
        row = _base_row()
        row.pop("community_name")
        out = _format_challenge(row)
        assert "community" not in out

    def test_is_joined_false_when_no_participant(self):
        out = _format_challenge(_base_row(), user_id="u1", participant=None)
        assert out["is_joined"] is False

    def test_is_joined_true_when_participant_present(self):
        out = _format_challenge(_base_row(), user_id="u1", participant={"status": "registered"})
        assert out["is_joined"] is True

class TestFormatChallengeSubmissionBlock:

    def test_no_my_submission_when_not_provided(self):
        out = _format_challenge(_base_row(), participant={"status": "registered"})
        assert "my_submission" not in out

    def test_my_submission_includes_score_and_feedback(self):
        submission = {
            "title": "My take",
            "description": "An answer",
            "submitted_at": datetime(2026, 4, 10, 8, 0, 0),
            "final_score": 87.5,
            "scores": {"Quality": 90, "Clarity": 85},
            "judge_feedback": "Strong work",
            "status": "approved",
        }
        out = _format_challenge(
            _base_row(),
            participant={"status": "submitted"},
            submission=submission,
        )
        assert out["my_submission"]["title"] == "My take"
        assert out["my_submission"]["score"] == 87.5
        assert out["my_submission"]["feedback"] == "Strong work"
        assert out["my_submission"]["submitted_at"] == "2026-04-10T08:00:00"

    def test_my_submission_handles_missing_score(self):
        submission = {
            "title": "Pending",
            "description": None,
            "submitted_at": None,
            "final_score": None,
            "scores": None,
            "judge_feedback": None,
            "status": "pending",
        }
        out = _format_challenge(_base_row(), submission=submission)
        assert out["my_submission"]["score"] is None
        assert out["my_submission"]["submitted_at"] is None

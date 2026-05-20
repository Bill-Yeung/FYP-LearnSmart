import json

import pytest

@pytest.mark.asyncio
async def test_playgame_script_load_and_progress_initialization(client, db, auth_headers, authenticated_user):
    user_id = authenticated_user["user"]["id"]
    outline = {
        "title": "PlayGame Business Logic Test",
        "scenes": [
            {
                "sceneId": "scene-1",
                "act": 1,
                "order": 1,
                "title": "Intro Scene",
                "location": "Training Lab",
                "description": "A simple training scenario.",
                "charactersPresent": [],
                "clues": [],
                "questions": ["q1"]
            }
        ],
        "questions": [
            {
                "questionId": "q1",
                "sceneId": "scene-1",
                "order": 1,
                "type": "multiple_choice",
                "content": "What is 2 + 2?",
                "knowledgeId": "K1",
                "relatedKnowledge": [],
                "difficulty": 1,
                "maxAttempts": 3,
                "masteryReward": 10,
                "options": [
                    {"optionId": "o1", "content": "3", "isCorrect": False, "feedback": "No"},
                    {"optionId": "o2", "content": "4", "isCorrect": True, "feedback": "Yes"}
                ],
                "learnMore": {"knowledgeId": "K1"}
            }
        ],
        "clues": [],
        "characters": [],
        "knowledgeBase": [
            {"knowledgeId": "K1", "name": "Addition", "description": "Basic arithmetic."}
        ],
        "endings": []
    }

    script_id = await db.fetchval(
        """
        INSERT INTO scripts (user_id, title, outline_json, module_name)
        VALUES ($1, $2, $3::jsonb, $4)
        RETURNING id
        """,
        user_id,
        "PlayGame Business Logic Test",
        json.dumps(outline),
        "unit",
    )

    play_response = await client.get(f"/api/game/play/{script_id}", headers=auth_headers)
    assert play_response.status_code == 200
    script_dto = play_response.json()
    assert script_dto["scriptId"] == str(script_id)
    assert script_dto["title"] == "PlayGame Business Logic Test"
    assert isinstance(script_dto.get("questions"), list)
    assert len(script_dto["questions"]) == 1
    assert script_dto["questions"][0]["questionId"] == "q1"

    progress_response = await client.get(f"/api/game/progress/{script_id}", headers=auth_headers)
    assert progress_response.status_code == 200
    progress = progress_response.json()
    assert progress["scriptId"] == str(script_id)
    assert progress["currentSceneId"] == "scene-1"
    assert progress["answeredQuestions"] == []
    assert progress["correctAnswers"] == []
    assert progress["wrongAnswers"] == []

@pytest.mark.asyncio
async def test_playgame_answer_submission_updates_progress(client, db, auth_headers, authenticated_user):
    user_id = authenticated_user["user"]["id"]
    outline = {
        "title": "PlayGame Answer Submission Test",
        "scenes": [
            {
                "sceneId": "scene-1",
                "act": 1,
                "order": 1,
                "title": "Scene One",
                "location": "Office",
                "description": "A short practice scene.",
                "charactersPresent": [],
                "clues": [],
                "questions": ["q1"]
            }
        ],
        "questions": [
            {
                "questionId": "q1",
                "sceneId": "scene-1",
                "order": 1,
                "type": "multiple_choice",
                "content": "Select the correct answer.",
                "knowledgeId": "K1",
                "relatedKnowledge": [],
                "difficulty": 1,
                "maxAttempts": 3,
                "masteryReward": 15,
                "options": [
                    {"optionId": "o1", "content": "Wrong", "isCorrect": False, "feedback": "Try again."},
                    {"optionId": "o2", "content": "Right", "isCorrect": True, "feedback": "Well done!"}
                ],
                "learnMore": {"knowledgeId": "K1"}
            }
        ],
        "clues": [],
        "characters": [],
        "knowledgeBase": [
            {"knowledgeId": "K1", "name": "Correct Reasoning", "description": "A core concept."}
        ],
        "endings": []
    }

    script_id = await db.fetchval(
        """
        INSERT INTO scripts (user_id, title, outline_json, module_name)
        VALUES ($1, $2, $3::jsonb, $4)
        RETURNING id
        """,
        user_id,
        "PlayGame Answer Submission Test",
        json.dumps(outline),
        "unit",
    )

    wrong_response = await client.post(
        f"/api/game/submit-answer?scriptId={script_id}",
        headers=auth_headers,
        json={
            "questionId": "q1",
            "sceneId": "scene-1",
            "knowledgeId": "K1",
            "selectedOption": "o1",
            "attemptNumber": 1,
            "hintsUsed": 0,
        },
    )
    assert wrong_response.status_code == 200
    wrong_result = wrong_response.json()
    assert wrong_result["isCorrect"] is False
    assert wrong_result["feedback"] == "Try again."
    assert wrong_result["progress"]["questionsAnswered"] == 0

    correct_response = await client.post(
        f"/api/game/submit-answer?scriptId={script_id}",
        headers=auth_headers,
        json={
            "questionId": "q1",
            "sceneId": "scene-1",
            "knowledgeId": "K1",
            "selectedOption": "o2",
            "attemptNumber": 2,
            "hintsUsed": 0,
        },
    )
    assert correct_response.status_code == 200
    correct_result = correct_response.json()
    assert correct_result["isCorrect"] is True
    assert correct_result["feedback"] == "Well done!"
    assert correct_result["progress"]["questionsAnswered"] == 1

    progress_response = await client.get(f"/api/game/progress/{script_id}", headers=auth_headers)
    assert progress_response.status_code == 200
    progress = progress_response.json()
    assert "q1" in progress["answeredQuestions"]
    assert "q1" in progress["correctAnswers"]
    assert progress["wrongAnswers"] == ["q1"]

@pytest.mark.asyncio
async def test_playgame_learn_later_save_progress_and_completion(client, db, auth_headers, authenticated_user):
    user_id = authenticated_user["user"]["id"]
    outline = {
        "title": "PlayGame Learn Later and Save Test",
        "scenes": [
            {
                "sceneId": "scene-1",
                "act": 1,
                "order": 1,
                "title": "Study Scene",
                "location": "Library",
                "description": "A test for save and learn later.",
                "charactersPresent": [],
                "clues": [],
                "questions": ["q1"]
            }
        ],
        "questions": [
            {
                "questionId": "q1",
                "sceneId": "scene-1",
                "order": 1,
                "type": "multiple_choice",
                "content": "Choose the right option.",
                "knowledgeId": "K1",
                "relatedKnowledge": [],
                "difficulty": 1,
                "maxAttempts": 3,
                "masteryReward": 10,
                "options": [
                    {"optionId": "o1", "content": "A", "isCorrect": False, "feedback": "Not A."},
                    {"optionId": "o2", "content": "B", "isCorrect": True, "feedback": "Correct."}
                ],
                "learnMore": {"knowledgeId": "K1"}
            }
        ],
        "clues": [],
        "characters": [],
        "knowledgeBase": [
            {"knowledgeId": "K1", "name": "Key Concept", "description": "Important knowledge."}
        ],
        "endings": []
    }

    script_id = await db.fetchval(
        """
        INSERT INTO scripts (user_id, title, outline_json, module_name)
        VALUES ($1, $2, $3::jsonb, $4)
        RETURNING id
        """,
        user_id,
        "PlayGame Learn Later and Save Test",
        json.dumps(outline),
        "unit",
    )

    add_response = await client.post(
        "/api/game/learn-later",
        headers=auth_headers,
        json={
            "knowledgeId": "K1",
            "scriptId": str(script_id),
            "triggerType": "manual",
            "triggerId": "q1",
        },
    )
    assert add_response.status_code == 200
    add_result = add_response.json()
    assert add_result["success"] is True

    learn_response = await client.get(f"/api/game/learn-later/list?scriptId={script_id}", headers=auth_headers)
    assert learn_response.status_code == 200
    learn_list = learn_response.json()
    assert learn_list["totalCount"] >= 1
    assert any(item["knowledgeId"] == "K1" for item in learn_list["items"])

    save_response = await client.post(
        f"/api/game/progress/{script_id}/save",
        headers=auth_headers,
        json={
            "progress": {
                "currentSceneId": "scene-1",
                "completedScenes": [],
                "unlockedClues": [],
                "collectedEvidence": [],
                "answeredQuestions": [],
                "correctAnswers": [],
                "wrongAnswers": [],
            },
            "currentAnswer": {
                "questionId": "q1",
                "sceneId": "scene-1",
                "knowledgeId": "K1",
                "selectedOption": "o1",
                "attemptNumber": 1,
                "hintsUsed": 0,
            },
        },
    )
    assert save_response.status_code == 200
    save_data = save_response.json()
    assert save_data["message"] == "Progress saved successfully"
    assert "progress" in save_data


@pytest.mark.asyncio
async def test_playgame_ask_detective_returns_hint(client, db, auth_headers, authenticated_user):
    user_id = authenticated_user["user"]["id"]
    outline = {
        "title": "PlayGame Detective Hint Test",
        "scenes": [
            {
                "sceneId": "scene-1",
                "act": 1,
                "order": 1,
                "title": "Hint Scene",
                "location": "Office",
                "description": "Scene for detective hint.",
                "charactersPresent": [],
                "clues": [],
                "questions": ["q1"]
            }
        ],
        "questions": [
            {
                "questionId": "q1",
                "sceneId": "scene-1",
                "order": 1,
                "type": "multiple_choice",
                "content": "Answer the question.",
                "knowledgeId": "K1",
                "relatedKnowledge": [],
                "difficulty": 1,
                "maxAttempts": 3,
                "masteryReward": 5,
                "options": [
                    {"optionId": "o1", "content": "A", "isCorrect": False, "feedback": "No."},
                    {"optionId": "o2", "content": "B", "isCorrect": True, "feedback": "Yes."}
                ],
                "learnMore": {"knowledgeId": "K1"}
            }
        ],
        "clues": [],
        "characters": [],
        "knowledgeBase": [
            {"knowledgeId": "K1", "name": "Hint Concept", "description": "Helpful knowledge."}
        ],
        "endings": []
    }

    script_id = await db.fetchval(
        """
        INSERT INTO scripts (user_id, title, outline_json, module_name)
        VALUES ($1, $2, $3::jsonb, $4)
        RETURNING id
        """,
        user_id,
        "PlayGame Detective Hint Test",
        json.dumps(outline),
        "unit",
    )

    hint_response = await client.post(
        "/api/game/ask-detective",
        headers=auth_headers,
        json={
            "scriptId": str(script_id),
            "sceneId": "scene-1",
            "questionId": "q1",
            "wrongAnswers": ["A"],
            "askCount": 1,
        },
    )
    assert hint_response.status_code == 200
    hint_result = hint_response.json()
    assert hint_result["isDetectiveHint"] is True
    assert isinstance(hint_result["feedback"], str)
    assert hint_result["feedback"] != ""


@pytest.mark.asyncio
async def test_playgame_report_returns_session_and_history_stats(client, db, auth_headers, authenticated_user):
    user_id = authenticated_user["user"]["id"]
    outline = {
        "title": "PlayGame Report Test",
        "scenes": [
            {
                "sceneId": "scene-1",
                "act": 1,
                "order": 1,
                "title": "Report Scene",
                "location": "Library",
                "description": "Scene for report generation.",
                "charactersPresent": [],
                "clues": [],
                "questions": ["q1"]
            }
        ],
        "questions": [
            {
                "questionId": "q1",
                "sceneId": "scene-1",
                "order": 1,
                "type": "multiple_choice",
                "content": "What is 1 + 1?",
                "knowledgeId": "K1",
                "relatedKnowledge": [],
                "difficulty": 1,
                "maxAttempts": 3,
                "masteryReward": 10,
                "options": [
                    {"optionId": "o1", "content": "1", "isCorrect": False, "feedback": "No."},
                    {"optionId": "o2", "content": "2", "isCorrect": True, "feedback": "Yes."}
                ],
                "learnMore": {"knowledgeId": "K1"}
            }
        ],
        "clues": [],
        "characters": [],
        "knowledgeBase": [
            {"knowledgeId": "K1", "name": "Addition", "description": "Basic math."}
        ],
        "endings": []
    }

    script_id = await db.fetchval(
        """
        INSERT INTO scripts (user_id, title, outline_json, module_name)
        VALUES ($1, $2, $3::jsonb, $4)
        RETURNING id
        """,
        user_id,
        "PlayGame Report Test",
        json.dumps(outline),
        "unit",
    )

    wrong_response = await client.post(
        f"/api/game/submit-answer?scriptId={script_id}",
        headers=auth_headers,
        json={
            "questionId": "q1",
            "sceneId": "scene-1",
            "knowledgeId": "K1",
            "selectedOption": "o1",
            "attemptNumber": 1,
            "hintsUsed": 0,
        },
    )
    assert wrong_response.status_code == 200

    correct_response = await client.post(
        f"/api/game/submit-answer?scriptId={script_id}",
        headers=auth_headers,
        json={
            "questionId": "q1",
            "sceneId": "scene-1",
            "knowledgeId": "K1",
            "selectedOption": "o2",
            "attemptNumber": 2,
            "hintsUsed": 0,
        },
    )
    assert correct_response.status_code == 200

    report_response = await client.get(f"/api/game/progress/{script_id}/report", headers=auth_headers)
    assert report_response.status_code == 200
    report = report_response.json()
    assert report["scriptId"] == str(script_id)
    assert "stats" in report
    assert "historyStats" in report
    assert report["stats"]["completionRate"] == report["historyStats"]["completionRate"]
    assert report["stats"]["sessions"] >= 1
    assert report["historyStats"]["sessions"] >= 1
    assert report["stats"]["activity"] == report["historyStats"]["activity"]
    assert report["performance"]["correctAnswers"] >= 0
    assert isinstance(report["wrongAnswerConcepts"], list)
    assert isinstance(report["reviewRecommendations"], list)


@pytest.mark.asyncio
async def test_my_scripts_endpoint_returns_user_scripts(client, db, auth_headers, authenticated_user):
    user_id = authenticated_user["user"]["id"]
    outline = {
        "title": "My Scripts Endpoint Test",
        "scenes": [
            {
                "sceneId": "scene-1",
                "act": 1,
                "order": 1,
                "title": "List Scene",
                "location": "Studio",
                "description": "Scene for my scripts listing.",
                "charactersPresent": [],
                "clues": [],
                "questions": ["q1"]
            }
        ],
        "questions": [
            {
                "questionId": "q1",
                "sceneId": "scene-1",
                "order": 1,
                "type": "multiple_choice",
                "content": "Test script listing.",
                "knowledgeId": "K1",
                "relatedKnowledge": [],
                "difficulty": 1,
                "maxAttempts": 3,
                "masteryReward": 10,
                "options": [
                    {"optionId": "o1", "content": "A", "isCorrect": False, "feedback": "No."},
                    {"optionId": "o2", "content": "B", "isCorrect": True, "feedback": "Yes."}
                ],
                "learnMore": {"knowledgeId": "K1"}
            }
        ],
        "clues": [],
        "characters": [],
        "knowledgeBase": [
            {"knowledgeId": "K1", "name": "Test Concept", "description": "List endpoint test."}
        ],
        "endings": []
    }

    script_id = await db.fetchval(
        """
        INSERT INTO scripts (user_id, title, outline_json, module_name)
        VALUES ($1, $2, $3::jsonb, $4)
        RETURNING id
        """,
        user_id,
        "My Scripts Endpoint Test",
        json.dumps(outline),
        "unit",
    )

    response = await client.get("/api/game/my-scripts", headers=auth_headers)
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, dict)
    assert "scripts" in payload
    assert any(str(script.get("script_id")) == str(script_id) for script in payload["scripts"])

    script_payload = next((script for script in payload["scripts"] if str(script.get("script_id")) == str(script_id)), None)
    assert script_payload is not None
    assert script_payload["document_hash"] is None or isinstance(script_payload["document_hash"], str)
    assert script_payload["module_name"] == "unit"
    assert script_payload["progressPercent"] == 0
    assert script_payload["completedSceneCount"] == 0
    assert script_payload["totalSceneCount"] == 1
    assert script_payload["lastReviewedAt"] is None or isinstance(script_payload["lastReviewedAt"], str)
    assert script_payload["title"] == "My Scripts Endpoint Test"


@pytest.mark.asyncio
async def test_my_scripts_endpoint_handles_scalar_completed_scenes(client, db, auth_headers, authenticated_user):
    user_id = authenticated_user["user"]["id"]
    outline = {
        "title": "Scalar Completed Scenes Test",
        "scenes": [
            {
                "sceneId": "scene-1",
                "act": 1,
                "order": 1,
                "title": "Scene One",
                "location": "Test Room",
                "description": "A scene for scalar progress storage.",
                "charactersPresent": [],
                "clues": [],
                "questions": ["q1"]
            }
        ],
        "questions": [],
        "clues": [],
        "characters": [],
        "knowledgeBase": [],
        "endings": []
    }

    script_id = await db.fetchval(
        """
        INSERT INTO scripts (user_id, title, outline_json, module_name)
        VALUES ($1, $2, $3::jsonb, $4)
        RETURNING id
        """,
        user_id,
        "Scalar Completed Scenes Test",
        json.dumps(outline),
        "unit",
    )

    await db.execute(
        """
        INSERT INTO user_progress (user_id, script_id, current_scene_id, completed_scenes)
        VALUES ($1, $2, 'scene-1', to_jsonb(1))
        """,
        user_id,
        script_id,
    )

    response = await client.get("/api/game/my-scripts", headers=auth_headers)
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, dict)
    assert any(str(script.get("script_id")) == str(script_id) for script in payload["scripts"])


@pytest.mark.asyncio
async def test_playgame_report_resets_session_when_no_progress(client, db, auth_headers, authenticated_user):
    user_id = authenticated_user["user"]["id"]
    outline = {
        "title": "PlayGame Current Session Fallback Test",
        "scenes": [
            {
                "sceneId": "scene-1",
                "act": 1,
                "order": 1,
                "title": "Fallback Scene",
                "location": "Library",
                "description": "A test for latest session fallback.",
                "charactersPresent": [],
                "clues": [],
                "questions": ["q1"]
            }
        ],
        "questions": [
            {
                "questionId": "q1",
                "sceneId": "scene-1",
                "order": 1,
                "type": "multiple_choice",
                "content": "What is 3 + 3?",
                "knowledgeId": "K1",
                "relatedKnowledge": [],
                "difficulty": 1,
                "maxAttempts": 3,
                "masteryReward": 10,
                "options": [
                    {"optionId": "o1", "content": "5", "isCorrect": False, "feedback": "No."},
                    {"optionId": "o2", "content": "6", "isCorrect": True, "feedback": "Yes."}
                ],
                "learnMore": {"knowledgeId": "K1"}
            }
        ],
        "clues": [],
        "characters": [],
        "knowledgeBase": [
            {"knowledgeId": "K1", "name": "Addition", "description": "Basic math."}
        ],
        "endings": []
    }

    script_id = await db.fetchval(
        """
        INSERT INTO scripts (user_id, title, outline_json, module_name)
        VALUES ($1, $2, $3::jsonb, $4)
        RETURNING id
        """,
        user_id,
        "PlayGame Current Session Fallback Test",
        json.dumps(outline),
        "unit",
    )

    response = await client.post(
        f"/api/game/submit-answer?scriptId={script_id}",
        headers=auth_headers,
        json={
            "questionId": "q1",
            "sceneId": "scene-1",
            "knowledgeId": "K1",
            "selectedOption": "o2",
            "attemptNumber": 1,
            "hintsUsed": 0,
        },
    )
    assert response.status_code == 200

    await db.execute(
        "DELETE FROM user_progress WHERE user_id = $1 AND script_id = $2",
        user_id,
        script_id,
    )

    report_response = await client.get(f"/api/game/progress/{script_id}/report", headers=auth_headers)
    assert report_response.status_code == 200
    report = report_response.json()
    
    assert report["stats"]["sessions"] == 0
    assert report["stats"]["completionRate"] == 0
    assert report["historyStats"]["completionRate"] > 0
    assert report["stats"]["lastReviewed"] == "No active session"


@pytest.mark.asyncio
async def test_playgame_report_handles_legacy_answers_without_session_id(client, db, auth_headers, authenticated_user):
    user_id = authenticated_user["user"]["id"]
    outline = {
        "title": "PlayGame Legacy Answer Without Session Test",
        "scenes": [
            {
                "sceneId": "scene-1",
                "act": 1,
                "order": 1,
                "title": "Legacy Session Scene",
                "location": "Archive Room",
                "description": "A test for legacy answers without session id.",
                "charactersPresent": [],
                "clues": [],
                "questions": ["q1"]
            }
        ],
        "questions": [
            {
                "questionId": "q1",
                "sceneId": "scene-1",
                "order": 1,
                "type": "multiple_choice",
                "content": "What is 2 + 2?",
                "knowledgeId": "K1",
                "relatedKnowledge": [],
                "difficulty": 1,
                "maxAttempts": 3,
                "masteryReward": 10,
                "options": [
                    {"optionId": "o1", "content": "3", "isCorrect": False, "feedback": "No."},
                    {"optionId": "o2", "content": "4", "isCorrect": True, "feedback": "Yes."}
                ],
                "learnMore": {"knowledgeId": "K1"}
            }
        ],
        "clues": [],
        "characters": [],
        "knowledgeBase": [
            {"knowledgeId": "K1", "name": "Addition", "description": "Basic math."}
        ],
        "endings": []
    }

    script_id = await db.fetchval(
        """
        INSERT INTO scripts (user_id, title, outline_json, module_name)
        VALUES ($1, $2, $3::jsonb, $4)
        RETURNING id
        """,
        user_id,
        "PlayGame Legacy Answer Without Session Test",
        json.dumps(outline),
        "unit",
    )

    response = await client.post(
        f"/api/game/submit-answer?scriptId={script_id}",
        headers=auth_headers,
        json={
            "questionId": "q1",
            "sceneId": "scene-1",
            "knowledgeId": "K1",
            "selectedOption": "o2",
            "attemptNumber": 1,
            "hintsUsed": 0,
        },
    )
    assert response.status_code == 200

    await db.execute(
        "UPDATE user_answers SET study_session_id = NULL WHERE user_id = $1 AND script_id = $2",
        user_id,
        script_id,
    )

    report_response = await client.get(f"/api/game/progress/{script_id}/report", headers=auth_headers)
    assert report_response.status_code == 200
    report = report_response.json()
    assert report["stats"]["completionRate"] == report["historyStats"]["completionRate"]
    assert report["stats"]["sessions"] == report["historyStats"]["sessions"]
    assert report["stats"]["activity"] == report["historyStats"]["activity"]

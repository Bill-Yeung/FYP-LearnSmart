import pytest
from datetime import date

from app.models.planWorkflow import DailyPlanTaskDTO, CreateDailyPlanTaskDTO, UpdateDailyPlanTaskDTO
from app.services.planWorkflow_service import PlanWorkflowService
from app.services.planStrategy import _build_task_candidate_pool

class DummyRepo:
    def __init__(self, snapshot=None):
        self.snapshot = snapshot
        self.saved = None
        self.snapshot_called = False
        self.list_daily_tasks_called = False
        self.saved_task = None

    async def get_weekly_plan_snapshot(self, user_id: str, target_date: date):
        self.snapshot_called = True
        return self.snapshot

    async def get_weekly_plan_snapshot_by_user(self, user_id: str):
        return self.snapshot

    async def save_weekly_plan_snapshot(self, user_id: str, start_date: date, week_template):
        self.saved = {
            "user_id": user_id,
            "start_date": start_date,
            "week_template": week_template,
        }
        self.snapshot = {"start_date": start_date, "week_template": week_template}
        return self.saved

    async def list_user_daily_plan_tasks(self, user_id: str):
        self.list_daily_tasks_called = True
        return []

    async def get_user_learn_later(self, user_id: str):
        return []

    async def get_user_answer_stats(self, user_id: str):
        return {}

    async def resolve_topic_title(self, k_id: str, s_id: str):
        return "Topic"

    async def upsert_daily_task(self, user_id: str, task: dict):
        task_id = task.get("id") or "task-1"
        return {
            "id": task_id,
            "userId": user_id,
            "title": task.get("title", "Untitled task"),
            "type": task.get("type", "memory"),
            "status": task.get("status", "pending"),
            "durationMinutes": task.get("durationMinutes", 20),
            "knowledgeId": task.get("knowledgeId"),
            "scriptId": task.get("scriptId"),
            "tags": task.get("tags", []),
        }

@pytest.mark.asyncio
async def test_get_weekly_plan_uses_existing_snapshot():
    today = date.today().isoformat()
    repo = DummyRepo(snapshot={
        "week_template": [
            {
                "date": today,
                "tasks": [
                    {
                        "id": "learnlater-1",
                        "title": "Sample task",
                        "type": "memory",
                        "status": "pending",
                        "durationMinutes": 25,
                        "userId": "user-1",
                    }
                ],
            }
        ]
    })

    service = PlanWorkflowService.__new__(PlanWorkflowService)
    service.repo = repo

    result = await service.get_weekly_plan("user-1")

    assert result == repo.snapshot["week_template"]
    assert repo.saved is None
    assert repo.snapshot_called

@pytest.mark.asyncio
async def test_build_task_candidate_pool_uses_composite_script_and_knowledge_key():
    class Repo:
        async def get_user_learn_later(self, user_id: str):
            return [
                {"script_id": "script-1", "knowledge_id": "k1", "is_learned": False, "added_at": "2026-04-01T00:00:00", "quiz_attempts": 0, "time_spent_minutes": 0, "tags": []},
                {"script_id": "script-2", "knowledge_id": "k1", "is_learned": False, "added_at": "2026-04-01T00:00:00", "quiz_attempts": 0, "time_spent_minutes": 0, "tags": []},
                {"script_id": "script-1", "knowledge_id": "k2", "is_learned": False, "added_at": "2026-04-01T00:00:00", "quiz_attempts": 0, "time_spent_minutes": 0, "tags": []},
            ]

        async def get_user_answer_stats(self, user_id: str):
            return {}

        async def resolve_topic_title(self, k_id: str, s_id: str):
            return f"Topic {s_id}:{k_id}"

    explicit_tasks = [
        {
            "id": "explicit-1",
            "scriptId": "script-1",
            "knowledgeId": "k1",
            "status": "pending",
            "createdAt": "2026-04-09T00:00:00Z",
        }
    ]
    repo = Repo()

    pool = await _build_task_candidate_pool(repo, "user-1", explicit_tasks, 5)

    assert all(not (task.get("scriptId") == "script-1" and task.get("knowledgeId") == "k1") for task in pool)
    assert any(task.get("scriptId") == "script-2" and task.get("knowledgeId") == "k1" for task in pool)
    assert any(task.get("scriptId") == "script-1" and task.get("knowledgeId") == "k2" for task in pool)

@pytest.mark.asyncio
async def test_update_daily_task_updates_weekly_snapshot_task():
    today = date.today().isoformat()
    repo = DummyRepo(snapshot={
        "start_date": date.today(),
        "week_template": [
            {
                "day": "Fri",
                "date": today,
                "tasks": [
                    {
                        "id": "learnlater-1",
                        "title": "Sample task",
                        "type": "memory",
                        "status": "pending",
                        "durationMinutes": 25,
                        "userId": "user-1",
                    }
                ],
            }
        ],
    })

    service = PlanWorkflowService.__new__(PlanWorkflowService)
    service.repo = repo

    updated = await service.update_daily_task("user-1", "learnlater-1", UpdateDailyPlanTaskDTO(title="Updated task"))

    assert updated.title == "Updated task"
    assert repo.saved is not None
    assert repo.saved["week_template"][0]["tasks"][0]["title"] == "Updated task"

@pytest.mark.asyncio
async def test_create_daily_task_syncs_weekly_snapshot():
    today = date.today().isoformat()
    repo = DummyRepo(snapshot={
        "start_date": date.today(),
        "week_template": [
            {
                "day": "Fri",
                "date": today,
                "tasks": [],
            }
        ],
    })

    service = PlanWorkflowService.__new__(PlanWorkflowService)
    service.repo = repo

    new_task = await service.create_daily_task("user-1", CreateDailyPlanTaskDTO(title="New task", type="memory", durationMinutes=20), today)

    assert new_task.title == "New task"
    assert repo.saved is not None
    assert len(repo.saved["week_template"][0]["tasks"]) == 1
    assert repo.saved["week_template"][0]["tasks"][0]["title"] == "New task"

@pytest.mark.asyncio
async def test_get_daily_tasks_generates_and_saves_weekly_snapshot_when_missing():
    today = date.today().isoformat()
    repo = DummyRepo(snapshot=None)

    service = PlanWorkflowService.__new__(PlanWorkflowService)
    service.repo = repo

    tasks = await service.get_daily_tasks("user-1", today)

    assert repo.saved is not None
    assert repo.saved["start_date"].isoformat() == today
    assert len(repo.saved["week_template"]) == 7
    assert repo.saved["week_template"][0]["date"] == today
    assert isinstance(tasks, list)
    assert all(isinstance(task, DailyPlanTaskDTO) for task in tasks)

@pytest.mark.asyncio
async def test_get_daily_tasks_with_none_date_uses_today():
    today = date.today().isoformat()
    repo = DummyRepo(snapshot=None)

    service = PlanWorkflowService.__new__(PlanWorkflowService)
    service.repo = repo

    tasks = await service.get_daily_tasks("user-1", None)

    assert repo.saved is not None
    assert repo.saved["start_date"].isoformat() == today
    assert len(repo.saved["week_template"]) >= 1
    assert any(day["date"] == today for day in repo.saved["week_template"])
    assert isinstance(tasks, list)
    assert all(isinstance(task, DailyPlanTaskDTO) for task in tasks)

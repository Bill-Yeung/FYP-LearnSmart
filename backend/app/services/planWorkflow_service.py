from typing import Any, Dict, List, Optional
from datetime import date

from app.repositories.planWorkflow_repo import PlanWorkflowRepository
from app.models.planWorkflow import PlanSummaryDTO, DailyPlanTaskDTO, CreateDailyPlanTaskDTO, UpdateDailyPlanTaskDTO
from app.services.planStrategy import weeklyPlanStrategy, _parse_date

class PlanWorkflowService:
    def __init__(self, db):
        self.repo = PlanWorkflowRepository(db)

    async def get_weekly_plan(self, user_id: str, start_date: Optional[str] = None) -> List[Dict[str, Any]]:
        target_date = _parse_date(start_date) or date.today()
        snapshot = await self.repo.get_weekly_plan_snapshot(user_id, target_date)
        if snapshot:
            return snapshot.get("week_template", [])

        return await weeklyPlanStrategy(self.repo, user_id, start_date=start_date)

    async def generate_weekly_plan(self, user_id: str, start_date: Optional[str] = None) -> List[Dict[str, Any]]:
        target_date = _parse_date(start_date) or date.today()
        week_template = await weeklyPlanStrategy(self.repo, user_id, start_date=start_date)
        await self.repo.save_weekly_plan_snapshot(user_id, target_date, week_template)
        return week_template

    async def refresh_weekly_plan(self, user_id: str, start_date: Optional[str] = None) -> List[Dict[str, Any]]:
        return await self.generate_weekly_plan(user_id, start_date)

    async def get_plan_summary(self, user_id: str) -> PlanSummaryDTO:
        raw = await self.repo.get_plan_summary(user_id)

        return PlanSummaryDTO(
            userId=user_id,
            totalStudyMinutes=int(raw.get("totalStudyMinutes", 0)),
            totalTasks=int(raw.get("totalTasks", 0)),
            completedTasks=int(raw.get("completedTasks", 0)),
            learnLaterCount=int(raw.get("learnLaterCount", 0)),
            masteryDistribution=raw.get("masteryDistribution", {
                "unfamiliar": 0,
                "familiar": 0,
                "proficient": 0,
                "mastered": 0,
            }),
            missedConcepts=raw.get("missedConcepts", []),
            recommendations=raw.get("recommendations", []),
            longTermGoals=raw.get("longTermGoals", []),
            weekTemplate=await self.get_weekly_plan(user_id),
            aiPlan=raw.get("aiPlan", None),
            abilityScores=raw.get("abilityScores", None),
            dailyStudyHeatmap=raw.get("dailyStudyHeatmap", None),
            recentActivities=raw.get("recentActivities", None),
            total_scripts=int(raw.get("total_scripts") or 0),
            completed_scenes=int(raw.get("completed_scenes") or 0),
            answered_questions=int(raw.get("answered_questions") or 0)
        )

    async def _find_snapshot_task(self, user_id: str, task_id: str) -> Optional[Dict[str, Any]]:
        snapshot = await self.repo.get_weekly_plan_snapshot_by_user(user_id)
        if not snapshot:
            return None

        for day in snapshot.get("week_template", []):
            for task in day.get("tasks", []):
                if task.get("id") == task_id:
                    return task
        return None

    async def _save_snapshot(self, user_id: str, snapshot: Dict[str, Any]) -> None:
        await self.repo.save_weekly_plan_snapshot(user_id, snapshot["start_date"], snapshot["week_template"])

    async def _sync_task_to_snapshot(self, user_id: str, task: Dict[str, Any], date_str: Optional[str] = None) -> None:
        target_date = _parse_date(date_str) if date_str else None
        snapshot = await self.repo.get_weekly_plan_snapshot(user_id, target_date) if target_date else None
        if not snapshot:
            return

        week_template = snapshot.get("week_template", [])
        task_id = task.get("id")
        updated = False
        for day in week_template:
            for idx, existing in enumerate(day.get("tasks", [])):
                if existing.get("id") == task_id:
                    day["tasks"][idx] = task
                    updated = True
                    break
            if updated:
                break

        if not updated:
            target_iso = target_date.isoformat()
            snapshot_day = next((d for d in week_template if d.get("date") == target_iso), None)
            if not snapshot_day:
                snapshot_day = {
                    "day": target_date.strftime("%a"),
                    "date": target_iso,
                    "focus": "Custom practice",
                    "blocks": 0,
                    "tasks": [],
                }
                week_template.append(snapshot_day)
                week_template.sort(key=lambda d: d.get("date", ""))
            snapshot_day["tasks"].append(task)
            updated = True

        if updated:
            for day in week_template:
                day["blocks"] = len(day.get("tasks", []))
                if not day.get("focus"):
                    day["focus"] = "Custom practice" if day.get("tasks") else "Rest / optional"
            await self._save_snapshot(user_id, snapshot)

    async def _update_task_in_snapshot(self, user_id: str, updated_task: Dict[str, Any]):
        snapshot = await self.repo.get_weekly_plan_snapshot(user_id, date.today())
        if snapshot:
            for day in snapshot.get("week_template", []):
                for i, t in enumerate(day.get("tasks", [])):
                    if t.get("id") == updated_task.get("id"):
                        day["tasks"][i] = updated_task
                        await self.repo.save_weekly_plan_snapshot(user_id, snapshot["start_date"], snapshot["week_template"])
                        return

    async def _delete_task_from_snapshot(self, user_id: str, task_id: str) -> bool:
        snapshot = await self.repo.get_weekly_plan_snapshot(user_id, date.today())
        if snapshot:
            for day in snapshot.get("week_template", []):
                tasks = day.get("tasks", [])
                for i, t in enumerate(tasks):
                    if t.get("id") == task_id:
                        del tasks[i]
                        await self.repo.save_weekly_plan_snapshot(user_id, snapshot["start_date"], snapshot["week_template"])
                        return True
        return False

    async def get_daily_tasks(self, user_id: str, date_str: str = None) -> List[DailyPlanTaskDTO]:
        target_date = _parse_date(date_str) or date.today()
        snapshot = await self.repo.get_weekly_plan_snapshot(user_id, target_date)
        if snapshot:
            snapshot_day = next(
                (day for day in snapshot.get("week_template", []) if day.get("date") == target_date.isoformat()),
                None,
            )
            if snapshot_day is not None:
                return [DailyPlanTaskDTO(**task) for task in snapshot_day.get("tasks", [])]

        week_template = await weeklyPlanStrategy(self.repo, user_id, start_date=target_date.isoformat())
        await self.repo.save_weekly_plan_snapshot(user_id, target_date, week_template)
        snapshot_day = next(
            (day for day in week_template if day.get("date") == target_date.isoformat()),
            None,
        )
        return [DailyPlanTaskDTO(**task) for task in snapshot_day.get("tasks", [])] if snapshot_day else []

    async def create_daily_task(self, user_id: str, payload: CreateDailyPlanTaskDTO, date_str: Optional[str] = None) -> DailyPlanTaskDTO:
        task_data = payload.dict()
        task_data["userId"] = user_id
        inserted = await self.repo.upsert_daily_task(user_id, task_data)
        await self._sync_task_to_snapshot(user_id, inserted, date_str)
        return DailyPlanTaskDTO(**inserted)

    async def update_daily_task(self, user_id: str, task_id: str, payload: UpdateDailyPlanTaskDTO) -> DailyPlanTaskDTO:
      
        tasks = await self.repo.list_user_daily_plan_tasks(user_id)
        match = next((t for t in tasks if t.get("id") == task_id), None)

        if not match:
            snapshot_task = await self._find_snapshot_task(user_id, task_id)
            if snapshot_task:
                snapshot_task.update({k: v for k, v in payload.dict(exclude_none=True).items()})
                await self._update_task_in_snapshot(user_id, snapshot_task)
                return DailyPlanTaskDTO(**snapshot_task)
            raise ValueError("Task not found")

        match.update({k: v for k, v in payload.dict(exclude_none=True).items()})
        updated = await self.repo.upsert_daily_task(user_id, match)
        await self._update_task_in_snapshot(user_id, updated)
        return DailyPlanTaskDTO(**updated)

    async def delete_daily_task(self, user_id: str, task_id: str) -> bool:

        tasks = await self.repo.list_user_daily_plan_tasks(user_id)
        match = next((t for t in tasks if t.get("id") == task_id), None)

        if match:
            await self.repo.delete_daily_task(user_id, task_id)
            
        removed_from_snapshot = await self._delete_task_from_snapshot(user_id, task_id)
        
        if not match and not removed_from_snapshot:
            raise ValueError("Task not found")
        return True

    async def mark_task_completed(self, user_id: str, task_id: str) -> DailyPlanTaskDTO:
        return await self.update_daily_task(user_id, task_id, UpdateDailyPlanTaskDTO(status="completed"))

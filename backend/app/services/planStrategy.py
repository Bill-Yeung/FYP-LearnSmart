from datetime import datetime, timedelta, date
from typing import Any, Dict, List, Optional, Tuple
import uuid

from app.repositories.planWorkflow_repo import PlanWorkflowRepository

DEFAULT_TASK_LIMIT = 5
MASTERY_SCORE = {
    "unfamiliar": 40,
    "familiar": 30,
    "proficient": 20,
    "mastered": 10,
}


def _parse_datetime(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str) and value:
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None
    return None


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"today"}:
            return date.today()
        try:
            return date.fromisoformat(value)
        except ValueError:
            weekdays = {
                "mon": 0, "monday": 0,
                "tue": 1, "tuesday": 1,
                "wed": 2, "wednesday": 2,
                "thu": 3, "thursday": 3,
                "fri": 4, "friday": 4,
                "sat": 5, "saturday": 5,
                "sun": 6, "sunday": 6,
            }
            if normalized in weekdays:
                target = weekdays[normalized]
                today = date.today()
                offset = (target - today.weekday() + 7) % 7
                return today if offset == 0 else today + timedelta(days=offset)
    return None


def _score_learn_later_item(item: Dict[str, Any], answer_stats: Dict[str, Dict[str, Any]]) -> Tuple[int, datetime]:
    score = 0
    mastery_level = item.get("mastery_level") or "familiar"
    score += MASTERY_SCORE.get(mastery_level, 25)

    if not item.get("is_learned"):
        score += 10

    stats = None
    knowledge_id = item.get("knowledge_id")
    if knowledge_id:
        stats = answer_stats.get(knowledge_id)

    if stats:
        attempts = stats.get("attempts", 0)
        correct = stats.get("correct", 0)
        if attempts > 0:
            correct_rate = correct / attempts
            score += int((1.0 - correct_rate) * 30)
            if correct_rate < 0.7:
                score += 10

        last_incorrect = _parse_datetime(stats.get("last_incorrect"))
        if last_incorrect:
            age = datetime.utcnow() - last_incorrect
            if age <= timedelta(days=14):
                score += 10
            elif age <= timedelta(days=30):
                score += 5

    added_at = _parse_datetime(item.get("added_at"))
    if added_at:
        age_days = (datetime.utcnow() - added_at).days
        if age_days >= 14:
            score += 10
        elif age_days >= 7:
            score += 5

    if item.get("quiz_attempts", 0) > 0:
        score += 5

    time_spent = item.get("time_spent_minutes")
    if isinstance(time_spent, int) and time_spent < 15:
        score += 5

    sort_time = added_at or datetime.min
    return score, sort_time


def _build_learn_later_task(item: Dict[str, Any], title: str, user_id: str) -> Dict[str, Any]:
    created_at = _parse_datetime(item.get("added_at"))
    script_id = item.get("script_id")
    knowledge_id = item.get("knowledge_id")
    unique_suffix = uuid.uuid4().hex[:8]

    primary_dimension = item.get("primary_dimension")
    task_type = "memory"
    if primary_dimension:
        pd_lower = str(primary_dimension).lower()
        if pd_lower in ["understanding", "comprehension"]:
            task_type = "understanding"
        elif pd_lower in ["logic", "association", "analysis", "evaluation"]:
            task_type = "logic"

    return {
        "id": f"learnlater-{item.get('knowledge_id')}-{unique_suffix}",
        "title": title,
        "type": task_type,
        "status": "completed" if item.get("is_learned") else "pending",
        "durationMinutes": 25,
        "userId": user_id,
        "knowledgeId": str(knowledge_id) if knowledge_id is not None else None,
        "scriptId": str(script_id) if script_id is not None else None,
        "tags": item.get("tags", ["learn-later"]),
        "createdAt": created_at.isoformat() if created_at else None,
    }


def _normalize_explicit_tasks(tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    def sort_key(task: Dict[str, Any]) -> Tuple[int, datetime]:
        status = task.get("status", "pending")
        if status == "in-progress":
            priority = 0
        elif status == "pending":
            priority = 1
        elif status == "completed":
            priority = 2
        else:
            priority = 3
        created_at = _parse_datetime(task.get("createdAt")) or datetime.min
        return priority, created_at

    return sorted(tasks, key=sort_key)


def _gather_existing_ids(tasks: List[Dict[str, Any]]) -> Tuple[set, set]:
    existing_script_ids = set()
    existing_task_keys = set()
    for task in tasks:
        script_id = task.get("scriptId")
        knowledge_id = task.get("knowledgeId")
        existing_task_keys.add((script_id, knowledge_id))
        if script_id is not None and knowledge_id is None:
            existing_script_ids.add(script_id)
    return existing_script_ids, existing_task_keys


async def _build_task_candidate_pool(
    repo: PlanWorkflowRepository,
    user_id: str,
    explicit_tasks: List[Dict[str, Any]],
    max_tasks: int,
) -> List[Dict[str, Any]]:
    existing_script_ids, existing_task_keys = _gather_existing_ids(explicit_tasks)
    incomplete_count = sum(1 for task in explicit_tasks if task.get("status") != "completed")

    candidates: List[Dict[str, Any]] = []
    if incomplete_count < max_tasks:
        learn_later = await repo.get_user_learn_later(user_id)
        answer_stats = await repo.get_user_answer_stats(user_id)

        for item in learn_later:
            if item.get("is_learned") and item.get("mastery_level") == "mastered":
                continue

            knowledge_id = item.get("knowledge_id")
            script_id = item.get("script_id")
            item_key = (script_id, knowledge_id)
            if item_key in existing_task_keys:
                continue
            if script_id is not None and script_id in existing_script_ids and (script_id, None) in existing_task_keys:
                continue

            title = await repo.resolve_topic_title(knowledge_id, script_id)
            score, sort_time = _score_learn_later_item(item, answer_stats)
            candidates.append({
                "score": score,
                "sort_time": sort_time,
                "item": item,
                "title": title,
            })

        candidates.sort(key=lambda entry: (-entry["score"], entry["sort_time"]))

    supplemental_tasks = []
    for candidate in candidates:
        if len(supplemental_tasks) + incomplete_count >= max_tasks:
            break
        item = candidate["item"]
        title = candidate["title"]
        supplemental_tasks.append(_build_learn_later_task(item, title, user_id))
        if item.get("knowledge_id"):
            existing_task_keys.add((item.get("script_id"), item.get("knowledge_id")))
        if item.get("script_id") and item.get("knowledge_id") is None:
            existing_script_ids.add(item.get("script_id"))

    return supplemental_tasks


async def _build_focus_text(tasks: List[Dict[str, Any]]) -> str:
    if not tasks:
        return "Rest / optional"

    titles = []
    for task in tasks:
        if task.get("scriptId") or task.get("knowledgeId"):
            if task.get("title") and task["title"] not in titles:
                titles.append(task["title"])
    if not titles:
        return "General practice"

    first_theme = titles[0]
    if len(first_theme) > 25:
        first_theme = first_theme[:22] + "..."
    focus = f"Focus on {first_theme}"
    if len(titles) > 1:
        focus += " and others"
    return focus


async def weeklyPlanStrategy(
    repo: PlanWorkflowRepository,
    user_id: str,
    start_date: Optional[str] = None,
    days: int = 7,
    daily_limit: int = DEFAULT_TASK_LIMIT,
) -> List[Dict[str, Any]]:
    start = _parse_date(start_date) or date.today()
    explicit_tasks = await repo.list_user_daily_plan_tasks(user_id)
    explicit_tasks = _normalize_explicit_tasks(explicit_tasks)

    supplemental_tasks = await _build_task_candidate_pool(repo, user_id, explicit_tasks, daily_limit * days)
    week_template: List[Dict[str, Any]] = []
    for offset in range(days):
        current_day = start + timedelta(days=offset)
        assigned = supplemental_tasks[offset * daily_limit:(offset + 1) * daily_limit]
        week_template.append({
            "day": current_day.strftime("%a"),
            "date": current_day.isoformat(),
            "focus": await _build_focus_text(assigned),
            "blocks": len(assigned),
            "tasks": assigned,
        })

    return week_template



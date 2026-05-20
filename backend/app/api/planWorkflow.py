from fastapi import APIRouter, Depends, HTTPException, Query, Path
from typing import Optional

from app.core.dependencies import get_current_user, get_postgres
from app.services.planWorkflow_service import PlanWorkflowService
from app.models.planWorkflow import CreateDailyPlanTaskDTO, UpdateDailyPlanTaskDTO

router = APIRouter(prefix="/plan-workflow", tags=["Plan Workflow"])

@router.get("/summary")
async def get_plan_summary(
    current_user=Depends(get_current_user),
    db=Depends(get_postgres)
):
    user_id = str(current_user["id"])
    service = PlanWorkflowService(db)
    try:
        return await service.get_plan_summary(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/daily-tasks")
async def get_daily_tasks(
    date: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres)
):
    user_id = str(current_user["id"])
    service = PlanWorkflowService(db)
    try:
        return await service.get_daily_tasks(user_id, date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/daily-tasks")
async def create_daily_task(
    payload: CreateDailyPlanTaskDTO,
    date: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres)
):
    user_id = str(current_user["id"])
    service = PlanWorkflowService(db)
    try:
        return await service.create_daily_task(user_id, payload, date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/daily-tasks/{task_id}")
async def update_daily_task(
    payload: UpdateDailyPlanTaskDTO,
    task_id: str = Path(...),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres)
):
    user_id = str(current_user["id"])
    service = PlanWorkflowService(db)
    try:
        return await service.update_daily_task(user_id, task_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/daily-tasks/{task_id}")
async def delete_daily_task(
    task_id: str = Path(...),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres)
):
    user_id = str(current_user["id"])
    service = PlanWorkflowService(db)
    try:
        success = await service.delete_daily_task(user_id, task_id)
        if success:
            return {"status": "ok", "message": "Task deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/daily-tasks/{task_id}/complete")
async def complete_daily_task(
    task_id: str = Path(...),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres)
):
    user_id = str(current_user["id"])
    service = PlanWorkflowService(db)
    try:
        return await service.mark_task_completed(user_id, task_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/weekly-plan/refresh")
async def refresh_weekly_plan(
    start_date: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres)
):
    user_id = str(current_user["id"])
    service = PlanWorkflowService(db)
    try:
        return {"weekTemplate": await service.refresh_weekly_plan(user_id, start_date)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/weekly-plan/generate")
async def generate_weekly_plan(
    start_date: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres)
):
    user_id = str(current_user["id"])
    service = PlanWorkflowService(db)
    try:
        return {"weekTemplate": await service.generate_weekly_plan(user_id, start_date)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

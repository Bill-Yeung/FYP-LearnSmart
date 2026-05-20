from datetime import datetime
from pydantic import BaseModel, field_validator
from typing import List, Optional, Dict, Any
from uuid import UUID

class PlanSummaryDTO(BaseModel):
    userId: Optional[str] = None
    totalStudyMinutes: int
    totalTasks: int
    completedTasks: int
    learnLaterCount: int
    masteryDistribution: Dict[str, int]
    missedConcepts: List[Dict[str, Any]]
    recommendations: List[str]
    longTermGoals: Optional[List[Dict[str, Any]]] = []
    weekTemplate: Optional[List[Dict[str, Any]]] = []
    aiPlan: Optional[Dict[str, Any]] = None
    abilityScores: Optional[Dict[str, float]] = None
    dailyStudyHeatmap: Optional[List[Dict[str, Any]]] = None
    recentActivities: Optional[List[Dict[str, Any]]] = None
    total_scripts: Optional[int] = 0
    completed_scenes: Optional[int] = 0
    answered_questions: Optional[int] = 0

class DailyPlanTaskDTO(BaseModel):
    id: str
    title: str
    type: str
    status: str
    durationMinutes: int
    userId: str
    knowledgeId: Optional[str] = None
    scriptId: Optional[str] = None
    tags: Optional[List[str]] = []
    createdAt: Optional[datetime] = None

    @field_validator("id", "userId", "knowledgeId", "scriptId", mode="before")
    def uuid_to_str(cls, v):
        if isinstance(v, UUID):
            return str(v)
        return v

class CreateDailyPlanTaskDTO(BaseModel):
    title: str
    type: str
    durationMinutes: int
    userId: Optional[str] = None
    knowledgeId: Optional[str] = None
    scriptId: Optional[str] = None
    tags: Optional[List[str]] = []

class UpdateDailyPlanTaskDTO(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    type: Optional[str] = None
    durationMinutes: Optional[int] = None
    tags: Optional[List[str]] = None

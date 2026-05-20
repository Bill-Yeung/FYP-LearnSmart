from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from enum import Enum

class QuestionType(str, Enum):
    MULTIPLE_CHOICE = "multiple_choice"
    SHORT_ANSWER = "short_answer"
    CODE = "code"
    ESSAY = "essay"

class AssessmentAnswerSubmit(BaseModel):
    assessment_id: UUID
    user_answer: str
    time_taken_seconds: int | None = None

class QuizRequest(BaseModel):
    subject: str | None = None
    difficulty: str | None = None
    lcc_code: str | None = None
    language: str = "en"
    limit: int = Field(default = 10, ge = 1, le = 50)

class AssessmentResponse(BaseModel):
    id: UUID
    concept_id: UUID
    concept_title: str
    question_type: str
    estimated_time_minutes: int | None = None
    question: str
    language: str
    subject: str | None = None
    lcc_code: str | None = None

    class Config:
        from_attributes = True

class AssessmentDetailResponse(BaseModel):
    id: UUID
    concept_id: UUID
    concept_title: str
    question_type: str
    estimated_time_minutes: int | None = None
    question: str
    correct_answer: str
    answer_explanations: dict | None = None
    assessment_criteria: dict | None = None
    comments: str | None = None
    language: str
    subject: str | None = None
    lcc_code: str | None = None
    verified_by_instructor: bool = False
    created_at: datetime

    class Config:
        from_attributes = True

class AssessmentResultResponse(BaseModel):
    assessment_id: UUID
    user_answer: str
    correct_answer: str
    is_correct: bool
    explanation: str | None = None
    concept_title: str

class QuizResponse(BaseModel):
    subject: str | None
    difficulty: str | None
    total_questions: int
    questions: list[AssessmentResponse]

from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class QuizAttemptCreate(BaseModel):
    activity_id: Optional[str] = None
    user_id: Optional[str] = None
    exam_question_id: str
    chosen_option: Optional[str] = None
    is_correct: Optional[bool] = None
    time_spent_seconds: Optional[int] = None
    attempt_time: Optional[datetime] = None


class QuizAttemptResponse(BaseModel):
    id: str
    activity_id: Optional[str] = None
    user_id: str
    exam_question_id: str
    chosen_option: Optional[str] = None
    is_correct: Optional[bool] = None
    time_spent_seconds: Optional[int] = None
    attempt_time: Optional[datetime] = None


class QuizQuestionResponse(BaseModel):
    id: str
    source_exam: str
    year: int
    paper: Optional[str] = None
    question_no: Optional[str] = None
    topic: Optional[str] = None
    question_stem: str
    question_type: Optional[str] = "open"
    options: Optional[dict] = None
    correct_answer: Optional[str] = None
    answer_explanation: Optional[str] = None
    related_concept_ids: Optional[list[str]] = None
    difficulty_level: Optional[int] = None


class EvaluateAnswerRequest(BaseModel):
    question_stem: str
    user_answer: str
    correct_answer: Optional[str] = None
    options: Optional[dict] = None
    answer_explanation: Optional[str] = None


class EvaluateAnswerResponse(BaseModel):
    is_correct: bool
    score: int  # 0-100
    confidence: float
    reasoning: str
    feedback: str


class GenerateMcqChoicesRequest(BaseModel):
    question_stem: str
    correct_answer: str


class GenerateMcqChoicesResponse(BaseModel):
    choices: list[str]
    correct_answer_index: int

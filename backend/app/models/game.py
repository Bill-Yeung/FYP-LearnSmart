from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional, Union
from uuid import UUID
import json
from pydantic import BaseModel


TemplatePayloadStatus = Literal["draft", "published"]


class BasicConfig(BaseModel):

    name: str
    target_level: str
    description: Optional[str] = None


class ContentConfig(BaseModel):

    source: str
    subject: Optional[str] = None
    subject_code: Optional[str] = None
    subject_name: Optional[str] = None


class DifficultyConfig(BaseModel):

    puzzle_mcq: Optional[int] = 3
    puzzle_sorting: Optional[int] = 1
    puzzle_fill: Optional[int] = 1


class ManualQuizConfig(BaseModel):

    mcq: int
    fill: int
    code: int
    sort: int
    short: int


class QuizDisabled(BaseModel):

    enabled: Literal[False]

class QuizEnabled(BaseModel):

    enabled: Literal[True]
    count_range: str
    pass_score: Optional[int] = None
    source: str
    mode: str
    manual_config: Optional[ManualQuizConfig] = None


QuizConfig = Union[QuizDisabled, QuizEnabled]



class TemplateBase(BaseModel):

    basic: BasicConfig
    content: ContentConfig
    difficulty: DifficultyConfig
    quiz: QuizConfig


class TemplateCreate(TemplateBase):

    status: Optional[TemplatePayloadStatus] = "draft"

    def to_db_dict(self):
    
        return {
            "name": self.basic.name,
            "description": self.basic.description,
            "target_level": self.basic.target_level,
            "difficulty_rules": json.dumps({
                "puzzle_mcq": self.difficulty.puzzle_mcq,
                "puzzle_sorting": self.difficulty.puzzle_sorting,
                "puzzle_fill": self.difficulty.puzzle_fill,
            }),
            "hasquiz": isinstance(self.quiz, QuizEnabled) and self.quiz.enabled,
            "quizsource": self.quiz.source if isinstance(self.quiz, QuizEnabled) and self.quiz.enabled else "doc_only",
            "questionset": json.dumps({
                "mode": self.quiz.mode if isinstance(self.quiz, QuizEnabled) and self.quiz.enabled else None,
                "count_range": self.quiz.count_range if isinstance(self.quiz, QuizEnabled) and self.quiz.enabled else None,
                "pass_score": self.quiz.pass_score if isinstance(self.quiz, QuizEnabled) and self.quiz.enabled else None,
                "manual_config": (
                    self.quiz.manual_config.model_dump() if isinstance(self.quiz, QuizEnabled) and self.quiz.enabled and self.quiz.manual_config is not None else None
                ),
            }) if isinstance(self.quiz, QuizEnabled) and self.quiz.enabled else None,
            "subject_code": self.content.subject_code,
        }


class GameTemplateResponse(TemplateBase):

    id: str
    version: int
    status: TemplatePayloadStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class AnalysisHelperResponse(BaseModel):
    document_name: Optional[str] = None
    concept: int
    structure: int
    apply: int
    difficulty_score: int
    modules: Optional[list[dict[str, Union[str, int]]]] = None
    document_hash: Optional[str] = None
    chunks: Optional[list[dict]] = None

    class Config:
        from_attributes = True

class ParsedDocumentResponse(BaseModel):

    document_name: str
    document_hash: str
    modules: dict
    summary: dict
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ScriptRequest(BaseModel):
    document_hash: str
    selectedTemplateId: Optional[str] = None
    selectedScope: Optional[str] = None
    chunks: str
    concepts: str
    relationships: str
    concept_chunk_mapping: Optional[str] = None
    # 或 dict

class ParsedStructureResponse(BaseModel):

        document_hash: str
        chunks: list[dict]
        concepts: list[dict]
        relationships: list[dict]

        class Config:
             from_attributes = True
class AnalysisResultResponse(BaseModel):

    document_hash: str
    document_name: Optional[str] = None
    modules: Optional[list[dict[str, Union[str, int]]]] = None
    summary: Optional[dict] = None
    chuncks: list[dict] = []
    concepts: list[dict] = []
    relationships: list[dict] = []

    class Config:
        from_attributes = True

class GameScriptResponse(BaseModel):

    script: dict

    class Config:
        from_attributes = True

class JudgeAnswerRequest(BaseModel):
    questionText: str
    userAnswer: str
    correctAnswers: Optional[list[str]] = None
    relatedKnowledge: Optional[str] = None
    
class JudgeAnswerResponse(BaseModel):
    isCorrect: bool
    feedback: str
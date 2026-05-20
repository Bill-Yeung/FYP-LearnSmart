import asyncpg
from uuid import UUID

class AssessmentRepository:

    def __init__(self, db: asyncpg.Connection):
        self.db = db

    async def get_by_id(self, concept_id: UUID, language: str = "en") -> asyncpg.Record | None:

        return await self.db.fetchrow(
            """
            SELECT
                c.id as concept_id,
                c.concept_type,
                c.difficulty_level,
                c.created_at,
                ad.id as assessment_id,
                ad.question_type,
                ad.estimated_time_minutes,
                at.question,
                at.correct_answer,
                at.answer_explanations,
                at.assessment_criteria,
                at.comments,
                at.language,
                ct.title as concept_title,
                ct.description as concept_description
            FROM concepts c
            JOIN assessment_details ad ON c.id = ad.concept_id
            JOIN assessment_translations at ON ad.id = at.assessment_id
            LEFT JOIN concept_translations ct ON c.id = ct.concept_id AND ct.language = at.language
            WHERE c.id = $1
              AND at.language = $2
              AND c.concept_type = 'assessment'
            LIMIT 1
            """,
            concept_id, language)

    async def create(
        self,
        concept_id: UUID,
        question_type: str,
        estimated_time_minutes: int | None = None) -> asyncpg.Record:
        """Create assessment details for a concept."""
        return await self.db.fetchrow(
            """
            INSERT INTO assessment_details (concept_id, question_type, estimated_time_minutes)
            VALUES ($1, $2, $3)
            RETURNING *
            """,
            concept_id, question_type, estimated_time_minutes)

    async def add_translation(
        self,
        assessment_id: UUID,
        language: str,
        question: str,
        correct_answer: str | None = None,
        answer_explanations: str | None = None,
        assessment_criteria: str | None = None,
        comments: str | None = None,
        is_primary: bool = False,
        translation_quality: str = "llm") -> asyncpg.Record:

        return await self.db.fetchrow(
            """
            INSERT INTO assessment_translations (
                assessment_id, language, question, correct_answer,
                answer_explanations, assessment_criteria, comments,
                is_primary, translation_quality
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (assessment_id, language) DO UPDATE SET
                question = EXCLUDED.question,
                correct_answer = EXCLUDED.correct_answer,
                answer_explanations = EXCLUDED.answer_explanations,
                assessment_criteria = EXCLUDED.assessment_criteria,
                comments = EXCLUDED.comments
            RETURNING *
            """,
            assessment_id, language, question, correct_answer,
            answer_explanations, assessment_criteria, comments,
            is_primary, translation_quality)

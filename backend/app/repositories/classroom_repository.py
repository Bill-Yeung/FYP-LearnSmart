from typing import Optional

class ClassroomRepository:
    def __init__(self, db):
        self.db = db

    async def get_student_classes(self, student_id: str):

        return await self.db.fetch(
            """
            SELECT c.id, c.name, c.description, c.created_at,
                   u.username AS teacher_username,
                   u.display_name AS teacher_display_name,
                   up.avatar_url AS teacher_avatar_url,
                   c.code AS course_code, c.name AS course_name,
                   (SELECT COUNT(*) FROM class_enrollments ce2 WHERE ce2.class_id = c.id AND ce2.status = 'active') AS student_count
            FROM class_enrollments ce
            JOIN classes c ON c.id = ce.class_id
            LEFT JOIN users u ON u.id = c.teacher_id
            LEFT JOIN user_profiles up ON up.user_id = c.teacher_id
            WHERE ce.student_id = $1 AND ce.status = 'active'
            ORDER BY c.created_at DESC
            """,
            student_id,
        )

    async def get_class_detail(self, class_id: str):

        return await self.db.fetchrow(
            """
            SELECT c.id, c.name, c.description, c.created_at,
                   c.teacher_id,
                   u.username AS teacher_username,
                   u.display_name AS teacher_display_name,
                   up.avatar_url AS teacher_avatar_url,
                   c.code AS course_code, c.name AS course_name,
                   (SELECT COUNT(*) FROM class_enrollments ce2 WHERE ce2.class_id = c.id AND ce2.status = 'active') AS student_count
            FROM classes c
            LEFT JOIN users u ON u.id = c.teacher_id
            LEFT JOIN user_profiles up ON up.user_id = c.teacher_id
            WHERE c.id = $1
            """,
            class_id,
        )

    async def get_classmates(self, class_id: str, exclude_user_id: Optional[str] = None):

        query = """
            SELECT u.id, u.username, u.email,
                   u.display_name, up.avatar_url,
                   ce.joined_at
            FROM class_enrollments ce
            JOIN users u ON u.id = ce.student_id
            LEFT JOIN user_profiles up ON up.user_id = u.id
            WHERE ce.class_id = $1 AND ce.status = 'active'
        """
        params = [class_id]
        if exclude_user_id:
            query += " AND ce.student_id != $2"
            params.append(exclude_user_id)
        query += " ORDER BY u.display_name ASC NULLS LAST, u.username ASC"
        return await self.db.fetch(query, *params)

    async def get_class_assignments(self, class_id: str, student_id: str | None = None):

        if student_id:
            return await self.db.fetch(
                """
                SELECT a.id, a.title, a.description, a.assignment_type,
                       a.due_at, a.created_at, a.template_id, a.script_id,
                       s.id AS submission_id, s.status AS submission_status,
                       s.submitted_at, s.script_id AS submission_script_id,
                       s.answer_text, s.grade, s.teacher_feedback
                FROM assignments a
                LEFT JOIN assignment_submissions s
                    ON s.assignment_id = a.id AND s.student_id = $2
                WHERE a.class_id = $1
                ORDER BY a.due_at ASC NULLS LAST, a.created_at DESC
                """,
                class_id, student_id,
            )
        return await self.db.fetch(
            """
            SELECT a.id, a.title, a.description, a.assignment_type,
                   a.due_at, a.created_at
            FROM assignments a
            WHERE a.class_id = $1
            ORDER BY a.due_at ASC NULLS LAST, a.created_at DESC
            """,
            class_id,
        )

    async def get_assignment(self, assignment_id: str):

        return await self.db.fetchrow(
            "SELECT * FROM assignments WHERE id = $1", assignment_id,
        )

    async def start_assignment(self, assignment_id: str, student_id: str):

        existing = await self.db.fetchrow(
            "SELECT id, status FROM assignment_submissions WHERE assignment_id = $1 AND student_id = $2",
            assignment_id, student_id,
        )
        if existing:
            return existing
        return await self.db.fetchrow(
            """
            INSERT INTO assignment_submissions (assignment_id, student_id, status)
            VALUES ($1, $2, 'in_progress')
            RETURNING id, status, submitted_at
            """,
            assignment_id, student_id,
        )

    async def submit_assignment(self, assignment_id: str, student_id: str):

        return await self.db.fetchrow(
            """
            UPDATE assignment_submissions
            SET status = 'submitted', submitted_at = NOW()
            WHERE assignment_id = $1 AND student_id = $2 AND status IN ('in_progress', 'not_started')
            RETURNING id, status, submitted_at
            """,
            assignment_id, student_id,
        )

    async def is_enrolled(self, class_id: str, student_id: str) -> bool:

        row = await self.db.fetchrow(
            "SELECT 1 FROM class_enrollments WHERE class_id = $1 AND student_id = $2 AND status = 'active'",
            class_id,
            student_id,
        )
        return row is not None

    async def get_teacher_classes(self, teacher_id: str):

        return await self.db.fetch(
            """
            SELECT c.id, c.name, c.description, c.status, c.created_at,
                   c.code AS course_code, c.name AS course_name,
                   (SELECT COUNT(*) FROM class_enrollments ce WHERE ce.class_id = c.id AND ce.status = 'active') AS student_count,
                   (SELECT COUNT(*) FROM class_enrollments ce WHERE ce.class_id = c.id AND ce.status = 'pending') AS pending_count
            FROM classes c
            WHERE c.teacher_id = $1
            ORDER BY c.created_at DESC
            """,
            teacher_id,
        )

    async def update_class_status(self, class_id: str, teacher_id: str, status: str):

        return await self.db.fetchrow(
            """
            UPDATE classes SET status = $1
            WHERE id = $2 AND teacher_id = $3
            RETURNING id, status
            """,
            status, class_id, teacher_id,
        )

    async def get_teacher_students(self, teacher_id: str):

        return await self.db.fetch(
            """
            SELECT DISTINCT ON (u.id)
                   u.id, u.username, u.email, u.display_name,
                   up.avatar_url,
                   ce.joined_at AS enrolled_at
            FROM classes c
            JOIN class_enrollments ce ON ce.class_id = c.id
            JOIN users u ON u.id = ce.student_id
            LEFT JOIN user_profiles up ON up.user_id = u.id
            WHERE c.teacher_id = $1
            ORDER BY u.id, ce.joined_at ASC
            """,
            teacher_id,
        )

    @staticmethod
    def _generate_code(length: int = 6) -> str:

        import secrets
        import string
        alphabet = string.ascii_uppercase + string.digits
        alphabet = alphabet.replace("0", "").replace("O", "").replace("1", "").replace("I", "").replace("L", "")
        return "".join(secrets.choice(alphabet) for _ in range(length))

    async def create_class(self, teacher_id: str, name: str, description: str, course_code: str | None = None):

        if course_code:
            exists = await self.db.fetchval("SELECT 1 FROM classes WHERE code = $1", course_code.upper())
            if exists:
                raise ValueError(f"Class code '{course_code.upper()}' is already taken. Please choose another.")
            course_code = course_code.upper()
        else:
            for _ in range(10):
                candidate = self._generate_code()
                exists = await self.db.fetchval("SELECT 1 FROM classes WHERE code = $1", candidate)
                if not exists:
                    course_code = candidate
                    break
            else:
                raise Exception("Failed to generate unique class code")

        row = await self.db.fetchrow(
            """
            INSERT INTO classes (teacher_id, code, name, description)
            VALUES ($1, $2, $3, $4)
            RETURNING id, name, description, created_at, code
            """,
            teacher_id, course_code, name, description,
        )
        return {**dict(row), "course_code": course_code}

    async def get_teacher_assignments(self, teacher_id: str):

        return await self.db.fetch(
            """
            SELECT a.id, a.title, a.description, a.assignment_type,
                   a.due_at, a.created_at, a.class_id,
                   c.name AS class_name,
                   c.code AS course_code,
                   (SELECT COUNT(*) FROM assignment_submissions s WHERE s.assignment_id = a.id) AS submission_count,
                   (SELECT COUNT(*) FROM class_enrollments ce WHERE ce.class_id = a.class_id) AS student_count
            FROM assignments a
            JOIN classes c ON c.id = a.class_id
            WHERE a.teacher_id = $1
            ORDER BY a.due_at ASC NULLS LAST, a.created_at DESC
            """,
            teacher_id,
        )

    async def create_assignment(self, teacher_id: str, class_id: str, title: str,
                                 description: str, assignment_type: str, due_at=None,
                                 script_id: str | None = None):

        return await self.db.fetchrow(
            """
            INSERT INTO assignments (class_id, teacher_id, title, description, assignment_type, due_at, script_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, title, description, assignment_type, due_at, created_at, class_id, script_id
            """,
            class_id, teacher_id, title, description, assignment_type, due_at, script_id,
        )

    async def update_assignment(self, assignment_id: str, teacher_id: str, title: str,
                                 description: str, assignment_type: str, due_at=None,
                                 script_id: str | None = None):

        return await self.db.fetchrow(
            """
            UPDATE assignments SET title = $1, description = $2, assignment_type = $3, due_at = $4, script_id = $5
            WHERE id = $6 AND teacher_id = $7
            RETURNING id, title, description, assignment_type, due_at, created_at, class_id, script_id
            """,
            title, description, assignment_type, due_at, script_id, assignment_id, teacher_id,
        )

    async def submit_text_answer(self, assignment_id: str, student_id: str, answer_text: str):

        existing = await self.db.fetchrow(
            "SELECT id FROM assignment_submissions WHERE assignment_id = $1 AND student_id = $2",
            assignment_id, student_id,
        )
        if existing:
            return await self.db.fetchrow(
                """
                UPDATE assignment_submissions
                SET answer_text = $1, status = 'submitted', submitted_at = NOW()
                WHERE assignment_id = $2 AND student_id = $3
                RETURNING id, status, submitted_at, answer_text
                """,
                answer_text, assignment_id, student_id,
            )
        return await self.db.fetchrow(
            """
            INSERT INTO assignment_submissions (assignment_id, student_id, answer_text, status, submitted_at)
            VALUES ($1, $2, $3, 'submitted', NOW())
            RETURNING id, status, submitted_at, answer_text
            """,
            assignment_id, student_id, answer_text,
        )

    async def grade_submission(self, submission_id: str, teacher_id: str, grade: float, feedback: str | None = None):

        return await self.db.fetchrow(
            """
            UPDATE assignment_submissions SET grade = $1, teacher_feedback = $2, status = 'graded', graded_at = NOW()
            WHERE id = $3 AND assignment_id IN (
                SELECT id FROM assignments WHERE teacher_id = $4
            )
            RETURNING id, grade, teacher_feedback, status, graded_at
            """,
            grade, feedback, submission_id, teacher_id,
        )

    async def get_assignment_submissions(self, assignment_id: str):

        return await self.db.fetch(
            """
            SELECT s.id, s.student_id, s.answer_text, s.status, s.grade, s.teacher_feedback,
                   s.submitted_at, s.graded_at, s.script_id,
                   u.username, u.display_name, up.avatar_url
            FROM assignment_submissions s
            JOIN users u ON u.id = s.student_id
            LEFT JOIN user_profiles up ON up.user_id = u.id
            WHERE s.assignment_id = $1
            ORDER BY s.submitted_at DESC NULLS LAST
            """,
            assignment_id,
        )

    async def delete_assignment(self, assignment_id: str, teacher_id: str):

        return await self.db.execute(
            "DELETE FROM assignments WHERE id = $1 AND teacher_id = $2",
            assignment_id, teacher_id,
        )

    async def get_student_detail(self, student_id: str, teacher_id: str):

        return await self.db.fetch(
            """
            SELECT c.id AS class_id, c.name AS class_name,
                   c.code AS course_code,
                   ce.joined_at,
                   (SELECT COUNT(*) FROM assignment_submissions s
                    JOIN assignments a ON a.id = s.assignment_id
                    WHERE s.student_id = $1 AND a.class_id = c.id) AS submissions_count,
                   (SELECT COUNT(*) FROM assignments a WHERE a.class_id = c.id) AS total_assignments
            FROM classes c
            JOIN class_enrollments ce ON ce.class_id = c.id AND ce.student_id = $1
            WHERE c.teacher_id = $2
            ORDER BY ce.joined_at DESC
            """,
            student_id, teacher_id,
        )

    async def join_class_by_code(self, class_code: str, student_id: str):

        cls = await self.db.fetchrow(
            "SELECT id FROM classes WHERE code = $1",
            class_code.upper(),
        )
        if not cls:
            return None

        existing = await self.db.fetchrow(
            "SELECT status FROM class_enrollments WHERE class_id = $1 AND student_id = $2",
            cls["id"],
            student_id,
        )
        if existing:
            if existing["status"] == "active":
                return "already_enrolled"
            if existing["status"] == "pending":
                return "pending"
            if existing["status"] == "rejected":
                await self.db.execute(
                    "UPDATE class_enrollments SET status = 'pending', joined_at = NOW() WHERE class_id = $1 AND student_id = $2",
                    cls["id"], student_id,
                )
                return "pending"

        await self.db.execute(
            "INSERT INTO class_enrollments (class_id, student_id, status) VALUES ($1, $2, 'pending')",
            cls["id"],
            student_id,
        )
        return "pending"

    async def get_pending_enrollments(self, class_id: str):

        return await self.db.fetch(
            """
            SELECT ce.id, ce.student_id, ce.joined_at,
                   u.username, u.display_name, up.avatar_url
            FROM class_enrollments ce
            JOIN users u ON u.id = ce.student_id
            LEFT JOIN user_profiles up ON up.user_id = u.id
            WHERE ce.class_id = $1 AND ce.status = 'pending'
            ORDER BY ce.joined_at ASC
            """,
            class_id,
        )

    async def approve_enrollment(self, enrollment_id: str, teacher_id: str):

        return await self.db.fetchrow(
            """
            UPDATE class_enrollments SET status = 'active'
            WHERE id = $1 AND class_id IN (SELECT id FROM classes WHERE teacher_id = $2)
            RETURNING id, class_id, student_id
            """,
            enrollment_id, teacher_id,
        )

    async def reject_enrollment(self, enrollment_id: str, teacher_id: str):

        return await self.db.fetchrow(
            """
            UPDATE class_enrollments SET status = 'rejected'
            WHERE id = $1 AND class_id IN (SELECT id FROM classes WHERE teacher_id = $2)
            RETURNING id, class_id, student_id
            """,
            enrollment_id, teacher_id,
        )

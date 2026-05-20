import asyncio
import logging
from datetime import date, datetime, timezone

from app.core.database import postgres_db

logger = logging.getLogger(__name__)


class FlashcardReminderService:

    def __init__(self):
        self._running = False
        self._task: asyncio.Task | None = None
        self._notified_today: dict[str, date] = {}

    async def _send_reminders(self):
        if not postgres_db.pool:
            logger.warning("DB pool not available for flashcard reminders")
            return

        today = datetime.now(timezone.utc).date()

        try:
            async with postgres_db.pool.acquire() as db:

                rows = await db.fetch(
                    """
                    SELECT fs.user_id::text, COUNT(*) AS due_count
                    FROM flashcard_schedules fs
                    WHERE fs.due_date <= NOW()
                    GROUP BY fs.user_id
                    """
                )

                if not rows:
                    return

                from app.services.messaging.notification_service import notification_service

                for row in rows:
                    user_id: str = row["user_id"]
                    due_count: int = row["due_count"]

                    if self._notified_today.get(user_id) == today:
                        continue

                    already_sent = await db.fetchval(
                        """
                        SELECT 1 FROM notifications
                        WHERE user_id = $1::uuid
                          AND notification_type = 'system'
                          AND action_data->>'original_type' = 'flashcard.daily_reminder'
                          AND created_at >= CURRENT_DATE
                        LIMIT 1
                        """,
                        user_id,
                    )
                    if already_sent:
                        self._notified_today[user_id] = today
                        continue

                    await notification_service.notify(
                        user_id=user_id,
                        event_type="flashcard.daily_reminder",
                        data={
                            "title": "Flashcards due for review",
                            "message": (
                                f"You have {due_count} flashcard{'s' if due_count != 1 else ''} "
                                "ready for review today. Keep your streak going!"
                            ),
                            "due_count": due_count,
                        },
                        persist=True,
                        db=db,
                    )

                    self._notified_today[user_id] = today
                    logger.info(
                        f"Sent daily flashcard reminder to user {user_id} ({due_count} cards due)"
                    )

        except Exception as e:
            logger.error(f"Flashcard reminder job failed: {e}")

    async def start(self, check_interval_minutes: int = 60):
        if self._running:
            logger.warning("Flashcard reminder service already running")
            return

        self._running = True
        logger.info(
            f"Starting flashcard reminder service (check every {check_interval_minutes} min)"
        )

        async def loop():
            while self._running:
                try:
                    await self._send_reminders()
                except Exception as e:
                    logger.error(f"Flashcard reminder loop error: {e}")
                await asyncio.sleep(check_interval_minutes * 60)

        self._task = asyncio.create_task(loop())

    def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            self._task = None
        logger.info("Flashcard reminder service stopped")


# Global instance
flashcard_reminder_service = FlashcardReminderService()

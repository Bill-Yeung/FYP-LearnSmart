import asyncio
import logging
from datetime import datetime, timedelta

from app.core.database import postgres_db
from app.repositories.source_repository import SourceRepository
from app.services.infrastructure.file_storage_service import file_storage_service
from app.repositories.qdrant_repository import qdrant_repository

logger = logging.getLogger(__name__)

class CleanupService:

    def __init__(self, retention_days: int = 30):
        self.retention_days = retention_days
        self._running = False
        self._task: asyncio.Task | None = None

    async def get_retention_policy(self, db, key: str) -> int:

        row = await db.fetchrow(
            "SELECT retain_days FROM data_retention_policy WHERE key = $1",
            key
        )
        return row["retain_days"] if row else 0

    async def cleanup_expired_documents(self) -> int:

        if not postgres_db.pool:
            logger.warning("Database pool not available for cleanup")
            return 0

        deleted_count = 0

        try:

            async with postgres_db.pool.acquire() as db:

                repo = SourceRepository(db)
                expired_docs = await repo.get_expired_deleted(self.retention_days)

                if not expired_docs:
                    logger.info("No expired documents to clean up")
                    return 0

                logger.info(f"Found {len(expired_docs)} documents to permanently delete")

                for doc in expired_docs:

                    doc_id = str(doc["id"])
                    doc_path = doc["document_path"]

                    try:

                        if doc_path:
                            await file_storage_service.delete_file(doc_path)

                        await file_storage_service.delete_extracted_media(doc_id)

                        await qdrant_repository.delete_chunks_by_document(doc_id)

                        await repo.hard_delete(doc["id"])

                        deleted_count += 1
                        logger.info(f"Permanently deleted document: {doc_id}")

                    except Exception as e:
                        logger.error(f"Failed to permanently delete document {doc_id}: {e}")

        except Exception as e:
            logger.error(f"Cleanup job failed: {e}")

        return deleted_count

    async def cleanup_audit_logs(self) -> int:

        if not postgres_db.pool:
            return 0

        deleted_count = 0
        try:
            async with postgres_db.pool.acquire() as db:
                retain_days = await self.get_retention_policy(db, "audit_log")
                if retain_days <= 0:
                    logger.info("Audit log retention set to forever, skipping cleanup")
                    return 0

                cutoff = datetime.utcnow() - timedelta(days=retain_days)
                result = await db.execute(
                    "DELETE FROM admin_audit_log WHERE created_at < $1",
                    cutoff
                )
                deleted_count = int(result.split()[-1]) if result else 0
                if deleted_count > 0:
                    logger.info(f"Deleted {deleted_count} audit logs older than {retain_days} days")
        except Exception as e:
            logger.error(f"Audit log cleanup failed: {e}")

        return deleted_count

    async def cleanup_user_sessions(self) -> int:

        if not postgres_db.pool:
            return 0

        deleted_count = 0
        try:
            async with postgres_db.pool.acquire() as db:
                retain_days = await self.get_retention_policy(db, "user_sessions")
                if retain_days <= 0:
                    logger.info("User sessions retention set to forever, skipping cleanup")
                    return 0

                cutoff = datetime.utcnow() - timedelta(days=retain_days)
             
                result = await db.execute(
                    """DELETE FROM user_sessions
                       WHERE expires_at < CURRENT_TIMESTAMP
                          OR last_activity < $1""",
                    cutoff
                )
                deleted_count = int(result.split()[-1]) if result else 0
                if deleted_count > 0:
                    logger.info(f"Deleted {deleted_count} expired/inactive user sessions")
        except Exception as e:
            logger.error(f"User sessions cleanup failed: {e}")

        return deleted_count

    async def run_all_cleanup(self) -> dict:

        results = {
            "documents": await self.cleanup_expired_documents(),
            "audit_logs": await self.cleanup_audit_logs(),
            "user_sessions": await self.cleanup_user_sessions(),
        }
        return results

    async def start_periodic_cleanup(self, interval_hours: int = 24):

        if self._running:
            logger.warning("Cleanup service already running")
            return

        self._running = True
        logger.info(f"Starting cleanup service (interval: {interval_hours}h)")

        async def run_cleanup_loop():

            while self._running:

                try:
                    results = await self.run_all_cleanup()
                    total = sum(results.values())
                    if total > 0:
                        logger.info(f"Cleanup complete: {results}")
                except Exception as e:
                    logger.error(f"Cleanup loop error: {e}")

                # Wait for next run
                await asyncio.sleep(interval_hours * 3600)

        self._task = asyncio.create_task(run_cleanup_loop())

    def stop(self):

        self._running = False
        if self._task:
            self._task.cancel()
            self._task = None
        logger.info("Cleanup service stopped")

# Global instance
cleanup_service = CleanupService(retention_days = 30)

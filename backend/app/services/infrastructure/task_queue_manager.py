import asyncio
import logging
from typing import Any, Callable
from dataclasses import dataclass, field
from enum import Enum
from uuid import uuid4

from app.core.enums import UserPriority

logger = logging.getLogger(__name__)

class QueueType(str, Enum):
    DOCUMENT_PROCESSING = "document_processing"
    AI_GENERATION = "ai_generation"
    OTHER_TASKS = "other_tasks"

@dataclass(order = True)
class PrioritizedTask:
    priority: int = field(compare = True)
    task_id: str = field(compare = False)
    queue_type: QueueType = field(compare = False)
    func: Callable = field(compare = False)
    args: tuple = field(compare = False)
    kwargs: dict = field(compare = False)

class TaskQueueManager:

    def __init__(self):

        self.queues: dict[QueueType, asyncio.PriorityQueue] = {}
        self.workers: dict[QueueType, list[asyncio.Task]] = {}
        self.running = False

        self.concurrency_limits = {
            QueueType.DOCUMENT_PROCESSING: 3,
            QueueType.AI_GENERATION: 4,
            QueueType.OTHER_TASKS: 5}

    async def initialize(self):

        if self.running:
            logger.warning("TaskQueueManager already running")
            return

        self.running = True

        for queue_type in QueueType:

            self.queues[queue_type] = asyncio.PriorityQueue()
            self.workers[queue_type] = []
            num_workers = self.concurrency_limits.get(queue_type, 1)

            for i in range(num_workers):
                worker = asyncio.create_task(
                    self._worker(queue_type, worker_id = i))
                self.workers[queue_type].append(worker)

        logger.info(f"TaskQueueManager initialized with {len(QueueType)} priority queues")
        
        for queue_type, limit in self.concurrency_limits.items():
            logger.info(f"  {queue_type.value}: {limit} workers")

    async def shutdown(self):

        if not self.running:
            return

        self.running = False

        for queue_type, worker_list in self.workers.items():
            for worker in worker_list:
                worker.cancel()

        for queue_type, worker_list in self.workers.items():
            await asyncio.gather(*worker_list, return_exceptions=True)

        logger.info("TaskQueueManager shutdown complete")

    def submit_task(
        self,
        queue_type: QueueType,
        func: Callable,
        priority: UserPriority = UserPriority.REGULAR,
        *args,
        **kwargs) -> str:
        
        if not self.running:
            raise RuntimeError("TaskQueueManager not initialized")

        task_id = str(uuid4())
        task = PrioritizedTask(
            priority = priority.value,
            task_id = task_id,
            queue_type = queue_type,
            func = func,
            args = args,
            kwargs = kwargs)

        self.queues[queue_type].put_nowait(task)
        priority_name = UserPriority(priority).name if isinstance(priority, int) else priority.name
        logger.debug(f"Task queued: {task_id} in {queue_type.value} with priority {priority_name}")

        return task_id

    async def submit_and_wait(
        self,
        queue_type: QueueType,
        func: Callable,
        priority: UserPriority = UserPriority.REGULAR,
        *args,
        **kwargs) -> Any:
       
        if not self.running:
            raise RuntimeError("TaskQueueManager not initialized")

        loop = asyncio.get_running_loop()
        future: asyncio.Future[Any] = loop.create_future()
        task_id = str(uuid4())

        async def _wrapper():
            try:
                result = await func(*args, **kwargs)
                if not future.cancelled():
                    future.set_result(result)
            except Exception as exc:
                if not future.cancelled():
                    future.set_exception(exc)

        task = PrioritizedTask(
            priority=priority.value,
            task_id=task_id,
            queue_type=queue_type,
            func=_wrapper,
            args=(),
            kwargs={})

        self.queues[queue_type].put_nowait(task)
        logger.debug(f"Task queued (awaitable): {task_id} in {queue_type.value}")

        return await future

    async def _worker(self, queue_type: QueueType, worker_id: int):

        logger.debug(f"Worker started: {queue_type.value} #{worker_id}")

        while self.running:

            try:

                task: PrioritizedTask = await self.queues[queue_type].get()
                priority_name = UserPriority(task.priority).name
                logger.debug(
                    f"Worker {queue_type.value} #{worker_id} processing task: {task.task_id} "
                    f"(priority: {priority_name})")

                try:

                    await task.func(*task.args, **task.kwargs)
                    logger.debug(f"Task completed: {task.task_id}")

                except Exception as e:
                    logger.error(f"Task failed: {task.task_id} | Error: {e}")

                finally:
                    self.queues[queue_type].task_done()

            except asyncio.CancelledError:
                logger.debug(f"Worker cancelled: {queue_type.value} #{worker_id}")
                break

            except Exception as e:
                logger.error(f"Worker error: {queue_type.value} #{worker_id} | Error: {e}")
                await asyncio.sleep(1)

        logger.debug(f"Worker stopped: {queue_type.value} #{worker_id}")

    def get_queue_size(self, queue_type: QueueType) -> int:

        if queue_type not in self.queues:
            return 0
        
        return self.queues[queue_type].qsize()

    def get_stats(self) -> dict:

        return {
            queue_type.value: {
                "pending": self.get_queue_size(queue_type),
                "workers": len(self.workers.get(queue_type, [])),
                "max_concurrent": self.concurrency_limits.get(queue_type, 0)}
            for queue_type in QueueType}

# Global instance
task_queue_manager = TaskQueueManager()

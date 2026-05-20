import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from typing import TypeVar, Callable, Any

logger = logging.getLogger(__name__)

T = TypeVar('T')

_executor = ThreadPoolExecutor(
    max_workers = 4,
    thread_name_prefix = "cpu_worker")

async def run_in_background(
    func: Callable[..., T],
    *args: Any,
    **kwargs: Any) -> T:
   
    loop = asyncio.get_running_loop()

    if kwargs:
        func_with_kwargs = partial(func, *args, **kwargs)
        return await loop.run_in_executor(_executor, func_with_kwargs)
    else:
        return await loop.run_in_executor(_executor, func, *args)


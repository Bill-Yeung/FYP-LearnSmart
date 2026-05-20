import asyncio
import httpx
import json
import time
from app.core.config import settings, PROVIDER_CONFIGS, ProviderConfig, ModelConfig, resolve_model, IMAGE_PROVIDER_CONFIG, resolve_embed_model
from app.services.ai.constants import CONTINUATION_HINT
from app.core.enums import UserPriority
import logging
from typing import AsyncIterator
from dataclasses import dataclass, field
from enum import IntEnum

from contextlib import asynccontextmanager
from langchain_core.messages import HumanMessage, SystemMessage, BaseMessage

try:
    from langchain_core.messages import trim_messages
except Exception:
    def trim_messages(messages, *args, **kwargs):
        return messages
try:
    from langchain_ollama import ChatOllama, OllamaEmbeddings
except Exception:
    ChatOllama = None
    OllamaEmbeddings = None

try:
    from langchain_openai.chat_models.base import BaseChatOpenAI
    from langchain_openai import OpenAIEmbeddings
except Exception:
    BaseChatOpenAI = None
    OpenAIEmbeddings = None
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.services.document.chunker import ContentChunk

logger = logging.getLogger(__name__)

class LLMPriority(IntEnum):
    CRITICAL = 0    # User-facing chat
    HIGH = 1        # Interactive features
    NORMAL = 2      # Background processing
    LOW = 3         # Batch jobs

class LLMConcurrencyLimiter:

    def __init__(self, max_concurrent):

        self._max_concurrent = max_concurrent
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._active_count = 0
        self._total_processed = 0

    async def submit(
        self,
        func,
        llm_priority: LLMPriority = LLMPriority.NORMAL,
        user_priority: UserPriority = UserPriority.REGULAR,
        *args,
        **kwargs):

        logger.debug(
            f"LLM request (llm={llm_priority.name}, user={user_priority.name})")

        async with self._semaphore:
            self._active_count += 1
            try:
                result = await func(*args, **kwargs)
                return result
            finally:
                self._active_count -= 1
                self._total_processed += 1

    def get_stats(self) -> dict:
        return {
            "max_concurrent": self._max_concurrent,
            "active": self._active_count,
            "total_processed": self._total_processed}

class ContentBudget:
   
    CHARS_PER_TOKEN = 4

    def __init__(self):
        self._splitters: dict[str, RecursiveCharacterTextSplitter] = {}

    def _resolve_provider(self, provider_name: str | None) -> str:
        if provider_name and provider_name in PROVIDER_CONFIGS:
            return provider_name
        return next(iter(PROVIDER_CONFIGS))

    def _get_context_window(self, provider_name: str | None = None, model_key: str | None = None) -> int:
        name = self._resolve_provider(provider_name)
        config = PROVIDER_CONFIGS[name]
        return resolve_model(config, model_key).context_window

    def _get_max_output_tokens(self, provider_name: str | None = None, model_key: str | None = None) -> int:
        name = self._resolve_provider(provider_name)
        config = PROVIDER_CONFIGS[name]
        return resolve_model(config, model_key).max_output_tokens

    def estimate_tokens(self, text: str) -> int:
        return len(text) // self.CHARS_PER_TOKEN

    def calculate_content_budget(
        self,
        prompt_tokens: int = 0,
        hints_tokens: int = 0,
        output_ratio: float = 1.0,
        provider_name: str | None = None,
        usage_ratio: float = 0.8,
        model_key: str | None = None,
        session: 'SessionContext | None' = None) -> tuple[int, int]:

        effective_provider = provider_name or (session.provider_name if session else None)

        effective_prompt_tokens = prompt_tokens

        if output_ratio >= 1.0:

            max_output = self._get_max_output_tokens(effective_provider, model_key)
            context_window = self._get_context_window(effective_provider, model_key)
            usable_output = int(max_output * usage_ratio)
            content_tokens = int(usable_output / output_ratio)

            total_needed = effective_prompt_tokens + hints_tokens + content_tokens + max_output
            if total_needed > context_window:
                available = int(context_window * usage_ratio) - effective_prompt_tokens - hints_tokens - max_output
                content_tokens = max(0, available)
                logger.warning(
                    f"Content budget (OUTPUT-LIMITED, CONTEXT-BOUND): "
                    f"context={context_window}, max_output={max_output}, "
                    f"prompt={effective_prompt_tokens}, hints={hints_tokens}, "
                    f"content_tokens={content_tokens} (reduced to fit)")
            else:
                logger.info(
                    f"Content budget (OUTPUT-LIMITED): max_output={max_output}, "
                    f"usable={usable_output}, output_ratio={output_ratio}, "
                    f"content_tokens={content_tokens}, "
                    f"headroom={context_window - total_needed}/{context_window}")
        else:

            context_window = self._get_context_window(effective_provider, model_key)
            usable = int(context_window * usage_ratio)
            available = usable - effective_prompt_tokens - hints_tokens
            content_tokens = int(available / (1 + output_ratio))

            logger.info(
                f"Content budget (CONTEXT-LIMITED): context={context_window}, "
                f"usable={usable}, prompt={effective_prompt_tokens}, hints={hints_tokens}, "
                f"output_ratio={output_ratio}, content_tokens={content_tokens}")

        content_chars = content_tokens * self.CHARS_PER_TOKEN
        return content_tokens, content_chars

    def batch_by_size(
        self,
        sections: list[tuple[any, str]],
        prompt_tokens: int = 0,
        hints_tokens: int = 0,
        output_ratio: float = 1.0,
        provider_name: str | None = None,
        model_key: str | None = None,
        session: 'SessionContext | None' = None) -> list[list[tuple[any, str]]]:

        if not sections:
            return []

        _, max_chars = self.calculate_content_budget(
            prompt_tokens = prompt_tokens,
            hints_tokens = hints_tokens,
            output_ratio = output_ratio,
            provider_name = provider_name,
            model_key = model_key,
            session = session)

        batches = []
        current_batch = []
        current_chars = 0

        for section_id, section_text in sections:

            section_chars = len(section_text)

            if section_chars > max_chars:
                if current_batch:
                    batches.append(current_batch)
                    current_batch = []
                    current_chars = 0
                batches.append([(section_id, section_text)])
                logger.warning(
                    f"Section {section_id} exceeds budget ({section_chars} > {max_chars} chars), "
                    "placed in separate batch")
                continue

            if current_chars + section_chars > max_chars:
                if current_batch:
                    batches.append(current_batch)
                current_batch = [(section_id, section_text)]
                current_chars = section_chars
            else:
                current_batch.append((section_id, section_text))
                current_chars += section_chars

        if current_batch:
            batches.append(current_batch)

        avg_sections = len(sections) / len(batches) if batches else 0
        logger.info(
            f"Batched {len(sections)} sections into {len(batches)} batches "
            f"(avg {avg_sections:.1f} sections/batch, max {max_chars} chars/batch)")

        return batches

    def chunk_text_by_size(
        self,
        text: str,
        prompt_tokens: int = 0,
        hints_tokens: int = 0,
        output_ratio: float = 1.0,
        provider_name: str | None = None,
        model_key: str | None = None,
        session: 'SessionContext | None' = None) -> list[ContentChunk]:

        if not text:
            return []

        content_tokens, content_chars = self.calculate_content_budget(
            prompt_tokens = prompt_tokens,
            hints_tokens = hints_tokens,
            output_ratio = output_ratio,
            provider_name = provider_name,
            model_key = model_key,
            session = session)

        if len(text) <= content_chars:
            return [ContentChunk(
                text = text,
                chunk_index = 0,
                total_chunks = 1,
                start_char = 0,
                end_char = len(text))]

        overlap_chars = settings.chunk_overlap_tokens * self.CHARS_PER_TOKEN
        splitter = RecursiveCharacterTextSplitter(
            chunk_size = content_chars,
            chunk_overlap = overlap_chars,
            length_function = len,
            separators = ["\n\n", "\n", ". ", " ", ""])

        chunks = splitter.split_text(text)
        result = []
        current_pos = 0

        for i, chunk_text in enumerate(chunks):

            start_pos = text.find(chunk_text[:100], current_pos) if len(chunk_text) >= 100 else text.find(chunk_text, current_pos)

            if start_pos == -1:
                start_pos = current_pos

            result.append(ContentChunk(
                text = chunk_text,
                chunk_index = i,
                total_chunks = len(chunks),
                start_char = start_pos,
                end_char = start_pos + len(chunk_text)))

            current_pos = start_pos + len(chunk_text) - overlap_chars

        logger.info(
            f"Chunked {len(text)} chars into {len(result)} chunks "
            f"(budget: {content_chars} chars/chunk)")

        return result

# Global instance
content_budget = ContentBudget()

class AIProviderError(Exception):
    pass

@dataclass
class SessionContext:
    system_prompt: str | None = None
    provider_name: str | None = None
    user_id: str | None = None
    _history: list[BaseMessage] = field(default_factory = list)

    def add_message(self, message: BaseMessage) -> None:

        self._history.append(message)

    def get_trimmed_history(self, max_tokens: int) -> list[BaseMessage]:

        if not self._history:
            return []

        return trim_messages(
            self._history,
            max_tokens = max_tokens,
            strategy = "last",
            token_counter = lambda msgs: sum(len(m.content) // ContentBudget.CHARS_PER_TOKEN for m in msgs),
            include_system = True)

class AIProvider:

    def __init__(self):

        self.providers: list[ProviderConfig] = list(PROVIDER_CONFIGS.values())
        self.current_provider_index = 0
        self._llm_clients: dict[str, object] = {}
        self._embed_clients: dict[str, object] = {}
        self._ollama_avail_cache: dict[str, tuple[bool, float]] = {}
        self._ollama_avail_ttl = 30
        self._provider_avail_cache: dict[str, tuple[bool, float]] = {}
        self._provider_health_locks: dict[str, asyncio.Lock] = {}
        self._semaphores: dict[str, asyncio.Semaphore] = {
            config.provider_name: asyncio.Semaphore(config.max_requests)
            for config in PROVIDER_CONFIGS.values()
        }

        self._image_semaphore = asyncio.Semaphore(1)

        total_max = sum(c.max_requests for c in PROVIDER_CONFIGS.values())
        self._limiter = LLMConcurrencyLimiter(max_concurrent = total_max)

        logger.info(
            f"AIProvider initialized with providers: "
            f"{[f'{p.provider_name}(max={p.max_requests})' for p in self.providers]}")

    @asynccontextmanager
    async def session(
        self,
        system_prompt: str | None = None,
        provider_name: str | None = None,
        user_id: str | None = None):
        ctx = SessionContext(
            system_prompt = system_prompt,
            provider_name = provider_name,
            user_id = user_id)
        yield ctx

    def _get_llm(
        self,
        provider: ProviderConfig,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        json_mode: bool = False,
        model_key: str | None = None):

        model = resolve_model(provider, model_key)

        if provider.is_local and provider.provider_name == "ollama":

            cache_key = f"ollama::{model.name}::{temperature}::{max_tokens}::{json_mode}"
            client = self._llm_clients.get(cache_key)
            if client:
                return client

            kwargs = {
                'model': model.name,
                'base_url': provider.base_url,
                'temperature': temperature,
                'num_ctx': model.context_window}

            if max_tokens is not None:
                kwargs['num_predict'] = max_tokens

            if json_mode:
                kwargs['format'] = 'json'

            kwargs['keep_alive'] = '30m'

            client = ChatOllama(**kwargs)
            self._llm_clients[cache_key] = client
            return client

        else:

            kwargs = {
                'model': model.name,
                'openai_api_key': provider.api_key or "no-key-needed",
                'openai_api_base': provider.base_url,
                'temperature': temperature,
                'request_timeout': model.request_timeout,
                'max_retries': 0}

            if max_tokens is not None:
                kwargs['max_tokens'] = max_tokens
            if json_mode:
                kwargs['model_kwargs'] = {'response_format': {'type': 'json_object'}}

            logger.info(f"{provider.provider_name}: model={model.name}, max_tokens={max_tokens}, json_mode={json_mode}")
            return BaseChatOpenAI(**kwargs)

    def _get_embedding_model(self, provider: ProviderConfig):

        if provider.provider_name == "ollama":
            key = f"ollama-embed::{settings.ollama_default_embed_model}"
            client = self._embed_clients.get(key)
            if client:
                return client
            client = OllamaEmbeddings(
                model = settings.ollama_default_embed_model,
                base_url = provider.base_url)
            self._embed_clients[key] = client
            return client

        if provider.provider_name == "macmini":
            embed_model = settings.macmini_default_embed_model

            for m in settings.macmini_embed_models:
                if m.get("key") == embed_model:
                    embed_model = m["name"]
                    break
            key = f"macmini-embed::{embed_model}"
            client = self._embed_clients.get(key)
            if client:
                return client
            client = OpenAIEmbeddings(
                model = embed_model,
                openai_api_key = "no-key-needed",
                openai_api_base = provider.base_url)
            self._embed_clients[key] = client
            return client

        return None

    async def check_provider_reachable(self, provider: ProviderConfig) -> bool:

        key = provider.provider_name

        cached = self._provider_avail_cache.get(key)
        if cached:
            available, ts = cached
            if time.time() - ts < 60:
                return available

        if key not in self._provider_health_locks:
            self._provider_health_locks[key] = asyncio.Lock()

        async with self._provider_health_locks[key]:
          
            cached = self._provider_avail_cache.get(key)
            if cached:
                available, ts = cached
                if time.time() - ts < 60:
                    return available

            try:
                async with httpx.AsyncClient() as client:
                    r = await client.get(f"{provider.base_url}/health", timeout = 30.0)
                    is_available = r.status_code == 200

                    # Sync concurrency limits from gateway health response
                    if is_available:
                        self._sync_provider_limits(provider, r.json())

            except Exception:
                is_available = False

            self._provider_avail_cache[key] = (is_available, time.time())
            if not is_available:
                logger.info(f"{key} not reachable, skipping")
            return is_available

    def _sync_provider_limits(self, provider: ProviderConfig, health_data: dict) -> None:

        key = provider.provider_name

        remote_max = health_data.get("max_chat_concurrency")
        if not remote_max or not isinstance(remote_max, int) or remote_max < 1:
            logger.debug(f"{key}: no max_chat_concurrency in /health, keeping max_requests={provider.max_requests}")
            return

        if remote_max == provider.max_requests:
            return

        old_max = provider.max_requests
        provider.max_requests = remote_max
        self._semaphores[key] = asyncio.Semaphore(remote_max)
        logger.info(
            f"Synced {key} concurrency from gateway: {old_max} -> {remote_max}")

    def get_provider_max_concurrent(self, provider_name: str) -> int:
     
        config = PROVIDER_CONFIGS.get(provider_name)
        return config.max_requests if config else 3

    def _estimate_response_tokens(
        self,
        response,
        prompt_tokens: int,
        result: str) -> int:

        usage = getattr(response, "usage_metadata", None)
        if isinstance(usage, dict):
            total = usage.get("total_tokens")
            if isinstance(total, int) and total > 0:
                return total
            input_tokens = usage.get("input_tokens")
            output_tokens = usage.get("output_tokens")
            if isinstance(input_tokens, int) and isinstance(output_tokens, int):
                return input_tokens + output_tokens

        metadata = getattr(response, "response_metadata", None)
        if isinstance(metadata, dict):
            token_usage = metadata.get("token_usage") or metadata.get("usage")
            if isinstance(token_usage, dict):
                total = token_usage.get("total_tokens")
                if isinstance(total, int) and total > 0:
                    return total
                prompt = token_usage.get("prompt_tokens")
                completion = token_usage.get("completion_tokens")
                if isinstance(prompt, int) and isinstance(completion, int):
                    return prompt + completion

        return max(1, prompt_tokens + (len(result) // ContentBudget.CHARS_PER_TOKEN))

    async def _record_token_usage(
        self,
        user_id: str | None,
        tokens_used: int,
        provider_name: str,
        model_name: str) -> None:

        if not user_id or tokens_used <= 0:
            return

        try:
            from app.core.database import postgres_db

            if postgres_db.pool is None:
                logger.debug("Skipping AI token usage record: Postgres pool is not connected")
                return

            async with postgres_db.pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO ai_token_usage (user_id, tokens_used, usage_month)
                    VALUES ($1::uuid, $2, DATE_TRUNC('month', CURRENT_DATE)::date)
                    ON CONFLICT (user_id, usage_month)
                    DO UPDATE SET
                      tokens_used = ai_token_usage.tokens_used + EXCLUDED.tokens_used,
                      updated_at = CURRENT_TIMESTAMP
                    """,
                    user_id,
                    tokens_used)
            logger.info(
                f"Recorded AI token usage: user_id={user_id}, tokens={tokens_used}, "
                f"provider={provider_name}, model={model_name}")
        except Exception as e:
            logger.warning(
                f"Failed to record AI token usage: user_id={user_id}, "
                f"tokens={tokens_used}, provider={provider_name}, model={model_name}, error={e}")

    async def check_ollama_available(self, model_name: str | None = None) -> bool:

        if model_name:
            cached = self._ollama_avail_cache.get(model_name)
            if cached:
                available, ts = cached
                if time.time() - ts < self._ollama_avail_ttl:
                    return available

        ollama_config = PROVIDER_CONFIGS.get("ollama")
        if not ollama_config:
            return False

        try:

            async with httpx.AsyncClient() as client:

                tags_resp = await client.get(
                    f"{ollama_config.base_url}/api/tags",
                    timeout = 2.0)

                if tags_resp.status_code != 200:
                    if model_name:
                        self._ollama_avail_cache[model_name] = (False, time.time())
                    return False

                if not model_name:
                    return True

                models = tags_resp.json().get("models", [])
                for m in models:
                    name = m.get("name", "") if isinstance(m, dict) else str(m)
                    if name == model_name or name == f"{model_name}:latest":
                        self._ollama_avail_cache[model_name] = (True, time.time())
                        return True

                if model_name in ollama_config.models:
                    logger.info(f"Ollama model '{model_name}' not found, pulling on-demand...")
                    pulled = await self.pull_ollama_model(model_name)
                    return pulled

                logger.warning(
                    f"Ollama model '{model_name}' not found at {ollama_config.base_url}")
                self._ollama_avail_cache[model_name] = (False, time.time())
                return False

        except Exception as e:

            logger.warning(f"Ollama availability check failed: {e}")
            if model_name:
                self._ollama_avail_cache[model_name] = (False, time.time())
            return False

    async def ensure_default_ollama_model(self) -> None:

        ollama_config = PROVIDER_CONFIGS.get("ollama")
        if not ollama_config:
            return

        default_name = resolve_model(ollama_config).name
        await self._pull_if_missing(ollama_config.base_url, default_name)

    async def pull_ollama_model(self, model_name: str) -> bool:
      
        ollama_config = PROVIDER_CONFIGS.get("ollama")
        if not ollama_config:
            return False
        return await self._pull_if_missing(ollama_config.base_url, model_name)

    async def _pull_if_missing(self, base_url: str, model_name: str) -> bool:

        try:

            async with httpx.AsyncClient() as client:

                resp = await client.get(f"{base_url}/api/tags", timeout = 5.0)
                if resp.status_code != 200:
                    logger.warning("Cannot reach Ollama to check models")
                    return False

                local_models = set()
                for m in resp.json().get("models", []):
                    name = m.get("name", "") if isinstance(m, dict) else str(m)
                    local_models.add(name)
                    if name.endswith(":latest"):
                        local_models.add(name.removesuffix(":latest"))

                if model_name in local_models or f"{model_name}:latest" in local_models:
                    logger.info(f"Ollama: {model_name} — ready")
                    self._ollama_avail_cache[model_name] = (True, time.time())
                    return True

                logger.info(f"Ollama: {model_name} — not found, pulling...")
                pull_resp = await client.post(
                    f"{base_url}/api/pull",
                    json={"name": model_name},
                    timeout=600.0)

                if pull_resp.status_code == 200:
                    logger.info(f"Ollama: {model_name} — pulled successfully")
                    self._ollama_avail_cache[model_name] = (True, time.time())
                    return True

                logger.warning(f"Ollama: failed to pull {model_name} (status {pull_resp.status_code})")
                return False

        except Exception as e:
            logger.warning(f"Ollama: pull check for {model_name} failed: {e}")
            return False

    async def generate(
        self,
        prompt: str,
        session: SessionContext,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        json_mode: bool = False,
        max_retries: int = 3,
        model_key: str | None = None,
        llm_priority: LLMPriority = LLMPriority.NORMAL,
        user_priority: UserPriority = UserPriority.REGULAR) -> str:

        return await self._limiter.submit(
            self._generate_internal,
            llm_priority,
            user_priority,
            prompt,
            session,
            temperature,
            max_tokens,
            json_mode,
            max_retries,
            model_key)

    async def generate_multiturn(
        self,
        prompt: str,
        session: SessionContext,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        json_mode: bool = False,
        model_key: str | None = None,
        llm_priority: LLMPriority = LLMPriority.NORMAL,
        user_priority: UserPriority = UserPriority.REGULAR) -> str:
        
        from langchain_core.messages import AIMessage

        pname = session.provider_name or (self.providers[0].provider_name if self.providers else None)
        provider = PROVIDER_CONFIGS.get(pname) if pname else None
        model = resolve_model(provider, model_key) if provider else None
        context_window = model.context_window if model else 32768
        output_budget = max_tokens or (model.max_output_tokens if model else 4096)

        sys_tokens = len(session.system_prompt) // ContentBudget.CHARS_PER_TOKEN if session.system_prompt else 0
        history_budget = int(context_window * 0.8) - sys_tokens - output_budget

        session.add_message(HumanMessage(content=prompt))

        trimmed = session.get_trimmed_history(max_tokens=max(history_budget, 512))

        if len(trimmed) > 1:
            context_parts = []
            for msg in trimmed[:-1]:
                role = "User" if isinstance(msg, HumanMessage) else "Assistant"
                context_parts.append(f"{role}: {msg.content}")
            context = "\n\n".join(context_parts)
            full_prompt = f"Previous conversation:\n{context}\n\nUser: {prompt}"
        else:
            full_prompt = prompt

        response = await self.generate(
            prompt=full_prompt,
            session=session,
            temperature=temperature,
            max_tokens=max_tokens,
            json_mode=json_mode,
            model_key=model_key,
            llm_priority=llm_priority,
            user_priority=user_priority)

        session.add_message(AIMessage(content=response))

        return response

    def _get_candidate_models(
        self,
        provider: ProviderConfig,
        model_key: str | None = None) -> list[tuple[str, ModelConfig]]:

        if model_key and model_key in provider.models:
            return [(model_key, provider.models[model_key])]

        default_key = provider.default_model
        candidates = []

        if default_key in provider.models:
            candidates.append((default_key, provider.models[default_key]))

        for key, model in sorted(
            provider.models.items(),
            key=lambda x: x[1].context_window,
            reverse=True):
            if key != default_key:
                candidates.append((key, model))

        return candidates

    async def _generate_internal(
        self,
        prompt: str,
        session: SessionContext,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        json_mode: bool = False,
        max_retries: int = 3,
        model_key: str | None = None) -> str:

        errors = []

        prompt_tokens = len(prompt) // ContentBudget.CHARS_PER_TOKEN
        if session.system_prompt:
            prompt_tokens += len(session.system_prompt) // ContentBudget.CHARS_PER_TOKEN

        provider_name = session.provider_name
        if provider_name:
            config = PROVIDER_CONFIGS.get(provider_name)
            if not config:
                raise AIProviderError(
                    f"Provider '{provider_name}' not found. "
                    f"Available: {list(PROVIDER_CONFIGS.keys())}")
            providers_to_try = [config]
        elif model_key:

            target_providers = [
                cfg for cfg in self.providers
                if model_key in cfg.models]
            if not target_providers:
                raise AIProviderError(
                    f"Model key '{model_key}' not found in any provider")
            providers_to_try = target_providers
        else:
            providers_to_try = self.providers

        # provider failover + retry with loop
        for provider in providers_to_try:

            candidates = self._get_candidate_models(provider, model_key)

            for candidate_key, model in candidates:

                try:

                    output_tokens = max_tokens or model.max_output_tokens
                    required_tokens = prompt_tokens + output_tokens
                    if required_tokens > model.context_window:
                        logger.info(
                            f"Skipping {provider.provider_name}/{model.name}: "
                            f"prompt+output ({required_tokens}) > context_window ({model.context_window})")
                        continue

                    model_info = f"{provider.provider_name} ({model.name})"
                    logger.info(f"Trying {model_info} for text generation...")

                    if provider.is_local and provider.provider_name == "ollama":
                        if not await self.check_ollama_available(model.name):
                            logger.warning(f"Ollama model '{model.name}' not available, skipping...")
                            continue

                    if provider.is_local and provider.provider_name != "ollama":
                        if not await self.check_provider_reachable(provider):
                            break

                    llm = self._get_llm(
                        provider,
                        temperature = temperature,
                        max_tokens = max_tokens,
                        json_mode = json_mode,
                        model_key = candidate_key)

                    messages = []
                    if session.system_prompt:
                        messages.append(SystemMessage(content=session.system_prompt))
                    messages.append(HumanMessage(content=prompt))
                    semaphore = self._semaphores.get(provider.provider_name)

                    async with semaphore:
                        for attempt in range(max_retries):

                            try:

                                response = await llm.ainvoke(messages)
                                result = response.content
                                tokens_used = self._estimate_response_tokens(
                                    response = response,
                                    prompt_tokens = prompt_tokens,
                                    result = result)
                                await self._record_token_usage(
                                    user_id = session.user_id,
                                    tokens_used = tokens_used,
                                    provider_name = provider.provider_name,
                                    model_name = model.name)
                                logger.info(f"Success with {model_info}")
                                self.current_provider_index = self.providers.index(provider)
                                return result

                            except Exception as e:

                                error_str = str(e).lower()

                                is_rate_limited = any(x in error_str for x in [
                                    'rate limit', '429', 'rate_limit'])
                                is_server_error = any(x in error_str for x in [
                                    '500', '502', '503', '504', 'temporarily unavailable'])
                                is_transient = any(x in error_str for x in [
                                    'timeout', 'connection'])

                                is_retryable = is_rate_limited or is_server_error or is_transient

                                if is_retryable and attempt < max_retries - 1:
                                    if is_rate_limited:
                                        wait_time = 15 + (attempt * 15)
                                    elif is_server_error:
                                        wait_time = 5 + (attempt * 5) 
                                    else:
                                        wait_time = 2 ** attempt

                                    logger.warning(
                                        f"{model_info} attempt {attempt + 1}/{max_retries} failed: {e}. "
                                        f"Retrying in {wait_time}s "
                                        f"({'rate-limited' if is_rate_limited else 'server-error' if is_server_error else 'transient'})...")
                                    await self._async_sleep(wait_time)
                                    continue
                                raise

                except Exception as e:

                    error_msg = f"{provider.provider_name}/{model.name}: {str(e)}"
                    errors.append(error_msg)
                    logger.warning(f"{error_msg}")
                    continue

        error_msg = f"All AI providers failed. Errors: {'; '.join(errors)}"
        logger.error(error_msg)
        raise AIProviderError(error_msg)

    async def _async_sleep(self, seconds: float):
        await asyncio.sleep(seconds)

    async def generate_stream(
        self,
        prompt: str,
        session: SessionContext,
        temperature: float = 0.7,
        max_tokens: int | None = None) -> AsyncIterator[str]:

        errors = []

        provider_name = session.provider_name
        if provider_name:
            config = PROVIDER_CONFIGS.get(provider_name)
            if not config:
                raise AIProviderError(
                    f"Provider '{provider_name}' not found. "
                    f"Available: {list(PROVIDER_CONFIGS.keys())}")
            providers_to_try = [config]
        else:
            providers_to_try = self.providers

        for provider in providers_to_try:

            try:

                model = resolve_model(provider)
                model_info = f"{provider.provider_name} ({model.name})"
                logger.info(f"Trying {model_info} for streaming generation...")

                if provider.is_local and provider.provider_name == "ollama":
                    if not await self.check_ollama_available(model.name):
                        logger.warning(f"Ollama model '{model.name}' not available, skipping...")
                        continue

                if provider.is_local and provider.provider_name != "ollama":
                    if not await self.check_provider_reachable(provider):
                        continue

                llm = self._get_llm(provider, temperature=temperature, max_tokens=max_tokens)

                messages = []
                if session.system_prompt:
                    messages.append(SystemMessage(content=session.system_prompt))
                messages.append(HumanMessage(content=prompt))

                semaphore = self._semaphores.get(provider.provider_name)

                try:

                    if hasattr(llm, 'astream'):
                        async with semaphore:
                            async for chunk in llm.astream(messages):
                                if isinstance(chunk, str):
                                    yield chunk
                                else:
                                    content = getattr(chunk, 'content', None) or getattr(chunk, 'text', None) or str(chunk)
                                    yield content
                        return

                except Exception as e:
                    logger.warning(f"Streaming call failed for {model_info}: {e}")

                async with semaphore:
                    response = await llm.ainvoke(messages)
                yield response.content
                logger.info(f"Streaming (fallback) success with {model_info}")
                self.current_provider_index = self.providers.index(provider)
                return

            except Exception as e:

                error_msg = f"{provider.provider_name}: {str(e)}"
                errors.append(error_msg)
                logger.warning(f"{error_msg}")
                continue

        fallback = {
            "missing_terms": ["details missing"],
            "logical_gaps": ["Could not analyze due to unavailable AI provider"],
            "unclear_reasoning": [],
            "analogies": [],
            "follow_up_questions": [],
            "revised_explanation": "Unable to generate a detailed revision because the AI provider is unavailable.",
            "summary": "AI provider unavailable; returning fallback analysis.",
            "score": 50}

        yield json.dumps(fallback)

    async def generate_with_continuation(
        self,
        prompt: str,
        session: SessionContext,
        **kwargs) -> str:
        
        hint_tokens = len(CONTINUATION_HINT) // ContentBudget.CHARS_PER_TOKEN + 1

        provider_name = session.provider_name
        provider = PROVIDER_CONFIGS.get(provider_name) if provider_name else (self.providers[0] if self.providers else None)
        model_key = kwargs.get("model_key")
        max_output = resolve_model(provider, model_key).max_output_tokens if provider else 8192

        parts = []
        total_chars = 0
        max_total_chars = max_output * ContentBudget.CHARS_PER_TOKEN
        call_count = 0
        original_max_tokens = kwargs.get("max_tokens")

        while total_chars < max_total_chars:

            if call_count == 0:
                current_prompt = prompt
            else:
                current_prompt = f"{CONTINUATION_HINT}\n\n{prompt}"
                if original_max_tokens:
                    kwargs["max_tokens"] = max(64, original_max_tokens - hint_tokens)

            result = await self.generate(prompt = current_prompt, session = session, **kwargs)
            parts.append(result)
            total_chars += len(result)
            call_count += 1

            if not self._is_truncated(result):
                break

            logger.info(
                f"Output appears truncated (call {call_count}, "
                f"{total_chars}/{max_total_chars} chars), continuing...")

        if total_chars >= max_total_chars:
            logger.warning(
                f"Continuation stopped: total output ({total_chars} chars) "
                f"reached model output limit ({max_total_chars} chars) after {call_count} calls")

        return "".join(parts)

    @staticmethod
    def _is_truncated(text: str) -> bool:

        if not text:
            return False

        stripped = text.rstrip()
        if not stripped:
            return False

        open_braces = stripped.count('{') - stripped.count('}')
        open_brackets = stripped.count('[') - stripped.count(']')
        if open_braces > 0 or open_brackets > 0:
            return True

        if stripped[-1] not in '.!?}]"\'`\n':
            return True

        return False

    def _truncate_for_embedding(self, text: str, provider_name: str) -> str:

        embed_cfg = resolve_embed_model(provider_name)
        if not embed_cfg:
            return text
        max_chars = embed_cfg.max_tokens * ContentBudget.CHARS_PER_TOKEN
        if len(text) <= max_chars:
            return text
        logger.warning(
            f"Embedding input truncated: {len(text)} -> {max_chars} chars "
            f"(model {embed_cfg.name} max_tokens={embed_cfg.max_tokens})")
        return text[:max_chars]

    async def get_embedding(
        self,
        text: str,
        provider_name: str | None = None) -> list[float]:

        providers_to_try = []
        for name in ["macmini", "ollama"]:
            config = PROVIDER_CONFIGS.get(name)
            if config:
                providers_to_try.append(config)

        if not providers_to_try:
            raise AIProviderError("No embedding provider available")

        errors = []

        for provider in providers_to_try:

            try:

                logger.info(f"Trying {provider.provider_name} for embeddings...")

                if provider.provider_name == "ollama":
                    if not await self.check_ollama_available(settings.ollama_default_embed_model):
                        logger.warning("Ollama not available or embedding model missing, trying next provider...")
                        continue

                embed_model = self._get_embedding_model(provider)
                if embed_model is None:
                    continue

                truncated = self._truncate_for_embedding(text, provider.provider_name)
                embedding_vector = embed_model.embed_query(truncated)
                logger.info(f"Success with {provider.provider_name} (dim: {len(embedding_vector)})")

                return embedding_vector

            except Exception as e:

                error_msg = f"{provider.provider_name}: {str(e)}"
                errors.append(error_msg)
                logger.warning(f"{error_msg}")
                continue

        raise AIProviderError(
            f"All embedding providers failed. Errors: {'; '.join(errors)}")

    async def get_embeddings_batch(
        self,
        texts: list[str],
        batch_size: int = 10) -> list[list[float]]:

        providers_to_try = []
        for name in ["macmini", "ollama"]:
            config = PROVIDER_CONFIGS.get(name)
            if config:
                providers_to_try.append(config)

        if not providers_to_try:
            raise AIProviderError("No embedding provider available")

        for provider in providers_to_try:

            try:

                logger.info(f"Trying {provider.provider_name} for batch embeddings...")

                if provider.provider_name == "ollama":
                    if not await self.check_ollama_available(settings.ollama_default_embed_model):
                        logger.warning("Ollama not available or embedding model missing, trying next provider...")
                        continue

                embed_model = self._get_embedding_model(provider)
                if embed_model is None:
                    continue

                truncated = [self._truncate_for_embedding(t, provider.provider_name) for t in texts]
                all_embeddings = embed_model.embed_documents(truncated)
                logger.info(f"Batch embeddings success with {provider.provider_name} ({len(texts)} texts)")

                return all_embeddings

            except Exception as e:

                logger.warning(f"{provider.provider_name}: {str(e)}")
                continue

        logger.info("Falling back to individual embedding calls...")
        all_embeddings = []

        for i, text in enumerate(texts):

            embedding = await self.get_embedding(text)
            all_embeddings.append(embedding)

            if (i + 1) % batch_size == 0:
                logger.info(f"Processed {i + 1}/{len(texts)} embeddings")

        return all_embeddings

    async def generate_image(
        self,
        prompt: str,
        width: int | None = None,
        height: int | None = None,
        num_inference_steps: int | None = None,
        guidance_scale: float | None = None,
        seed: int | None = None) -> dict:

        if not IMAGE_PROVIDER_CONFIG:
            raise AIProviderError("Image generation not configured (FLUX_MODEL is empty)")

        config = IMAGE_PROVIDER_CONFIG
        model = config.model

        payload = {
            "prompt": prompt,
            "width": min(width or 512, model.max_width),
            "height": min(height or 512, model.max_height),
            "num_inference_steps": num_inference_steps or model.default_steps,
            "guidance_scale": guidance_scale if guidance_scale is not None else model.default_guidance}

        if seed is not None:
            payload["seed"] = seed

        logger.info(f"Image generation: {model.name}, {payload['width']}x{payload['height']}, steps={payload['num_inference_steps']}")

        macmini_url = settings.macmini_base_url
        if macmini_url:
            try:
                async with self._image_semaphore:
                    async with httpx.AsyncClient() as client:
                        resp = await client.post(
                            f"{macmini_url}/generate-image",
                            json=payload,
                            timeout=model.request_timeout)
                        resp.raise_for_status()
                        logger.info("Image generated via Mac Mini")
                        return resp.json()
            except Exception as e:
                logger.info(f"Mac Mini image generation unavailable ({e}), attempting fallback...")
                macmini_error = str(e)

        url = f"{config.base_url}/generate"
        try:
            async with self._image_semaphore:
                async with httpx.AsyncClient() as client:
                    resp = await client.post(url, json=payload, timeout=model.request_timeout)
                    resp.raise_for_status()
                    return resp.json()
        except httpx.ConnectError:

            if config.provider_name == "flux" and settings.macmini_base_url:
                raise AIProviderError(
                    f"Image generation service unavailable. Mac Mini ({settings.macmini_base_url}) is not responding. "
                    f"Please ensure Mac Mini FLUX service is running on port 8001."
                )
            raise AIProviderError("Image generation service not available. Is the flux container running?")
        except Exception as e:
            logger.warning(f"Image generation failed: {e}")
            raise AIProviderError(str(e))

    def get_current_provider(self) -> str:

        if self.current_provider_index < len(self.providers):
            return self.providers[self.current_provider_index].provider_name

        return "none"

    def get_available_providers(self) -> dict[str, bool]:
        return {config.provider_name: True for config in PROVIDER_CONFIGS.values()}

    def estimate_cost(self, num_calls: int) -> float:

        if self.current_provider_index < len(self.providers):
            cost_per_call = self.providers[self.current_provider_index].cost_per_call
            return cost_per_call * num_calls

        return 0.0

    def get_limiter_stats(self) -> dict:
        return self._limiter.get_stats()

# Global instance
ai_provider = AIProvider()

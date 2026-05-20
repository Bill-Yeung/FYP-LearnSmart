"""
AI Services

Provides AI/LLM capabilities including:
- Text generation (DeepSeek, Ollama)
- Embeddings (Ollama, OpenAI)
- Content budget calculation
- Prompt templates
"""
from app.core.enums import UserPriority
from app.services.ai.provider import (
    AIProvider,
    AIProviderError,
    ContentBudget,
    LLMPriority,
    LLMConcurrencyLimiter,
    ai_provider,
    content_budget
)
from app.services.document.chunker import ContentChunk
from app.services.ai.embeddings import (
    EmbeddingService,
    embedding_service
)
from app.services.ai.prompts import (
    PromptTemplate,
    EXTRACTION_PROMPT,
    FLASHCARD_PROMPT,
    SUMMARY_PROMPT,
    PROMPTS,
    get_prompt,
    format_hints_section,
    estimate_hints_tokens
)

__all__ = [
    # Provider
    "AIProvider",
    "AIProviderError",
    "ContentBudget",
    "ContentChunk",
    "LLMPriority",
    "UserPriority",
    "LLMConcurrencyLimiter",
    "ai_provider",
    "content_budget",
    # Embeddings
    "EmbeddingService",
    "embedding_service",
    # Prompts
    "PromptTemplate",
    "EXTRACTION_PROMPT",
    "FLASHCARD_PROMPT",
    "SUMMARY_PROMPT",
    "PROMPTS",
    "get_prompt",
    "format_hints_section",
    "estimate_hints_tokens"
]

from dataclasses import dataclass, field
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):

    # Application
    app_name: str = Field(default = "Learning Platform")
    app_version: str = Field(default = "1.0.0")
    debug: bool = Field(default = False)

    # PostgreSQL
    postgres_host: str
    postgres_port: int
    postgres_user: str
    postgres_password: str
    postgres_db: str

    @property
    def postgres_url(self) -> str:
        return f"postgresql://{self.postgres_user}:{self.postgres_password}@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"

    # Neo4j
    neo4j_host: str
    neo4j_port: int
    neo4j_user: str
    neo4j_password: str

    @property
    def neo4j_url(self) -> str:
        return f"neo4j://{self.neo4j_host}:{self.neo4j_port}"
    
    # Qdrant
    qdrant_host: str
    qdrant_port: int
    qdrant_collection: str
    qdrant_dimensions: int

    @property
    def qdrant_url(self) -> str:
        return f"http://{self.qdrant_host}:{self.qdrant_port}"

    # Ollama
    ollama_host: str
    ollama_port: int
    ollama_max_requests: int
    ollama_default_embed_model: str
    ollama_embed_models: list[dict]
    ollama_default_model: str
    ollama_models: list[dict]

    @property
    def ollama_url(self) -> str:
        return f"http://{self.ollama_host}:{self.ollama_port}"

    @property
    def ollama_base_url(self) -> str:
        return self.ollama_url

    # Central model provider gateway.
    # Kept as MACMINI_* for env compatibility: live and local both call this
    # gateway; local may run it on a separate Mac mini.
    macmini_base_url: str = Field(default = "")
    macmini_base_urls: list[str] = Field(default_factory = list)
    model_gateway_backoff_seconds: int = Field(default = 10)
    macmini_max_requests: int = Field(default = 3)
    macmini_default_model: str = Field(default = "qwen-32b")
    macmini_models: list[dict] = Field(default_factory = list)
    macmini_default_embed_model: str = Field(default = "bge-m3")
    macmini_embed_models: list[dict] = Field(default_factory = list)

    # Document image classification
    image_classifier_local_model: str = Field(default = "/root/.cache/huggingface/hub/clip-local")
    image_classifier_allow_hf_download: bool = Field(default = False)
    image_classifier_hf_token: str = Field(default = "")
    image_classifier_hf_model: str = Field(default = "timm/ViT-B-16-SigLIP")
    image_classifier_hf_provider: str = Field(default = "hf-inference")

    @property
    def model_gateway_urls(self) -> list[str]:
        urls = []
        for value in [self.macmini_base_url, *self.macmini_base_urls]:
            for url in str(value).split(","):
                clean = url.strip().rstrip("/")
                if clean and clean not in urls:
                    urls.append(clean)
        return urls

    # Image generation (FLUX.1) — now handled by the model provider gateway
    flux_host: str = Field(default="")
    flux_port: int = Field(default=8100)
    flux_model: str = Field(default="")
    flux_device: str = Field(default="cpu")

    @property
    def flux_base_url(self) -> str:
        return f"http://{self.flux_host}:{self.flux_port}"

    # DeepSeek API
    deepseek_api_key: str = Field(default = "")
    deepseek_base_url: str
    deepseek_max_requests: int
    deepseek_default_model: str
    deepseek_models: list[dict]

    # Qwen API
    qwen_api_key: str = Field(default = "")
    qwen_base_url: str
    qwen_max_requests: int
    qwen_default_model: str
    qwen_models: list[dict]

    # OpenRouter
    openrouter_api_key: str = Field(default = "")
    openrouter_base_url: str
    openrouter_max_requests: int
    openrouter_default_model: str
    openrouter_models: list[dict]

    # Context Window & Chunking
    max_context_usage: float
    chunk_overlap_tokens: int

    # File Storage
    upload_dir: str

    # JWT authentication
    secret_key: str
    algorithm: str
    access_token_expire_minutes: int
    refresh_token_expire_days: int

    # OAuth
    google_client_id: str = Field(default = "")
    google_client_secret: str = Field(default = "")
    google_redirect_uri: str = Field(default = "")
    github_client_id: str = Field(default = "")
    github_client_secret: str = Field(default = "")
    github_redirect_uri: str = Field(default = "")

    # CORS
    cors_origins: list[str]

    # Email Service Configuration
    email_provider: str = Field(default = "smtp")  # "smtp" or "console" (dev mode)
    email_from_email: str = Field(default = "")
    email_from_name: str = Field(default = "Learning Platform")

    # Gmail SMTP Configuration (Port 465 with SSL)
    smtp_host: str = Field(default = "smtp.gmail.com")
    smtp_port: int = Field(default = 465)
    smtp_username: str = Field(default = "")
    smtp_password: str = Field(default = "")  # Use Gmail App Password

    class Config:
        env_file = ".env" 
        extra = "ignore"
        case_sensitive = False

# Global settings instance
settings = Settings()

@dataclass
class ModelConfig:
    name: str 
    context_window: int
    max_output_tokens: int
    request_timeout: int = 300

@dataclass
class ProviderConfig:
    provider_name: str
    api_key: str
    base_url: str
    max_requests: int = 10
    models: dict[str, ModelConfig] = field(default_factory = dict)
    default_model: str = "default"
    is_local: bool = False
    cost_per_call: float = 0.0

def resolve_model(config: ProviderConfig, model_key: str | None = None) -> ModelConfig:

    key = model_key or config.default_model
    return config.models.get(key, config.models[config.default_model])

def _parse_models(
    model_list: list[dict],
    default_context: int = 32768,
    default_max_output: int = 8192,
    default_timeout: int = 300) -> dict[str, ModelConfig]:

    models: dict[str, ModelConfig] = {}
    for m in model_list:
        key = m.get("key", m["name"])
        models[key] = ModelConfig(
            name = m["name"],
            context_window = m.get("context_window", default_context),
            max_output_tokens = m.get("max_output", default_max_output),
            request_timeout = m.get("timeout", default_timeout))
    return models

def build_provider_configs() -> dict[str, ProviderConfig]:

    configs: dict[str, ProviderConfig] = {}

    # Priority 0: DeepSeek (cloud API, high quality)
    if settings.deepseek_api_key:
        models = _parse_models(settings.deepseek_models, default_context = 131072)
        if not models:
            models["deepseek-chat"] = ModelConfig(name = settings.deepseek_default_model, context_window = 131072, max_output_tokens = 8192)
        configs["deepseek"] = ProviderConfig(
            provider_name = "deepseek",
            api_key = settings.deepseek_api_key,
            base_url = settings.deepseek_base_url,
            max_requests = settings.deepseek_max_requests,
            models = models,
            default_model = settings.deepseek_default_model,
            cost_per_call = 0.001)

    # Priority 1: OpenRouter
    if settings.openrouter_api_key:
        models = _parse_models(settings.openrouter_models)
        if not models:
            models[settings.openrouter_default_model] = ModelConfig(name = settings.openrouter_default_model, context_window = 8192, max_output_tokens = 4096)
        configs["openrouter"] = ProviderConfig(
            provider_name = "openrouter",
            api_key = settings.openrouter_api_key,
            base_url = settings.openrouter_base_url,
            max_requests = settings.openrouter_max_requests,
            models = models,
            default_model = settings.openrouter_default_model,
            cost_per_call = 0.0009)

    # Priority 2: Qwen
    if settings.qwen_api_key:
        models = _parse_models(settings.qwen_models)
        if not models:
            models[settings.qwen_default_model] = ModelConfig(name = settings.qwen_default_model, context_window = 32768, max_output_tokens = 4096)
        configs["qwen"] = ProviderConfig(
            provider_name = "qwen",
            api_key = settings.qwen_api_key,
            base_url = settings.qwen_base_url,
            max_requests = settings.qwen_max_requests,
            models = models,
            default_model = settings.qwen_default_model,
            cost_per_call = 0.0008)

    # Priority 3: Central model provider gateway
    if settings.macmini_base_url:
        models = _parse_models(settings.macmini_models)
        if not models:
            models[settings.macmini_default_model] = ModelConfig(
                name = settings.macmini_default_model, context_window = 32768, max_output_tokens = 8192)
        configs["macmini"] = ProviderConfig(
            provider_name = "macmini",
            api_key = "",
            base_url = settings.macmini_base_url,
            max_requests = settings.macmini_max_requests,
            models = models,
            default_model = settings.macmini_default_model,
            is_local = True,
            cost_per_call = 0.0)

    # Priority 4: Ollama (local Docker, last resort)
    ollama_models = _parse_models(settings.ollama_models)
    if not ollama_models:
        ollama_models[settings.ollama_default_model] = ModelConfig(
            name = settings.ollama_default_model,
            context_window = 32768,
            max_output_tokens = 8192)

    configs["ollama"] = ProviderConfig(
        provider_name = "ollama",
        api_key = "",
        base_url = settings.ollama_base_url,
        max_requests = settings.ollama_max_requests,
        models = ollama_models,
        default_model = settings.ollama_default_model,
        is_local = True,
        cost_per_call = 0.0)

    return configs

PROVIDER_CONFIGS: dict[str, ProviderConfig] = build_provider_configs()

@dataclass
class EmbedModelConfig:
    name: str
    dimensions: int
    max_tokens: int = 512

def _parse_embed_models(
    model_list: list[dict],
    default_dimensions: int = 1024,
    default_max_tokens: int = 512) -> dict[str, EmbedModelConfig]:

    models: dict[str, EmbedModelConfig] = {}
    for m in model_list:
        key = m.get("key", m["name"])
        models[key] = EmbedModelConfig(
            name = m["name"],
            dimensions = m.get("dimensions", default_dimensions),
            max_tokens = m.get("max_tokens", default_max_tokens))
    return models

def build_embed_configs() -> dict[str, dict[str, EmbedModelConfig]]:

    configs: dict[str, dict[str, EmbedModelConfig]] = {}

    if settings.macmini_embed_models:
        configs["macmini"] = _parse_embed_models(settings.macmini_embed_models)

    if settings.ollama_embed_models:
        configs["ollama"] = _parse_embed_models(settings.ollama_embed_models)

    return configs

EMBED_CONFIGS: dict[str, dict[str, EmbedModelConfig]] = build_embed_configs()

def resolve_embed_model(provider_name: str, model_key: str | None = None) -> EmbedModelConfig | None:

    provider_models = EMBED_CONFIGS.get(provider_name)
    if not provider_models:
        return None
    if model_key and model_key in provider_models:
        return provider_models[model_key]

    return next(iter(provider_models.values()), None)

@dataclass
class ImageModelConfig:
    name: str 
    default_steps: int = 4
    default_guidance: float = 0.0
    max_width: int = 1024
    max_height: int = 1024
    request_timeout: int = 300

@dataclass
class ImageProviderConfig:
    provider_name: str
    base_url: str
    model: ImageModelConfig
    device: str # "cuda" or "cpu"
    is_local: bool = True

def build_image_provider_config() -> ImageProviderConfig | None:

    if not settings.flux_model:
        return None

    return ImageProviderConfig(
        provider_name = "flux",
        base_url = settings.flux_base_url,
        model = ImageModelConfig(
            name = settings.flux_model,
            default_steps = 4,
            default_guidance = 0.0),
        device = settings.flux_device,
        is_local = True)

IMAGE_PROVIDER_CONFIG: ImageProviderConfig | None = build_image_provider_config()

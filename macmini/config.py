import sys
from pydantic_settings import BaseSettings
from pydantic import Field

def _resolve_env_file() -> str:
    for i, arg in enumerate(sys.argv):
        if arg == "--env-file" and i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return ".env"

class GatewaySettings(BaseSettings):
    bind_host: str
    port: int
    base_url: str
    timeout: int

    allowed_models: list[str]

    max_chat_concurrency: int
    max_embed_concurrency: int
    max_clip_concurrency: int
    max_whisper_concurrency: int

    max_flux_concurrency: int
    sdxl_model: str = ""
    flux_model: str = ""

    hf_token: str = ""

    model_cache_dir: str

    class Config:
        env_file = _resolve_env_file()
        extra = "ignore"
        case_sensitive = False

settings = GatewaySettings()

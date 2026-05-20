import logging
import os
import socket
from urllib.parse import urlparse

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def _proxy_env_snapshot() -> dict[str, str]:
    keys = ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY")
    return {key: os.environ.get(key, "") for key in keys if os.environ.get(key)}


def log_gateway_diagnostics(reason: str, level: int = logging.WARNING) -> None:
    urls = settings.model_gateway_urls
    logger.log(
        level,
        "Gateway network diagnostics start: reason=%s, gateway_urls=%s, proxy_env=%s",
        reason,
        urls or ["<unset>"],
        _proxy_env_snapshot() or {},
    )

    for url in urls:
        parsed = urlparse(url)
        host = parsed.hostname
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        if not host:
            logger.log(level, "Gateway diagnostics invalid URL: url=%s", url)
            continue

        try:
            addr_info = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
            resolved = sorted({item[4][0] for item in addr_info})
            logger.log(
                level,
                "Gateway diagnostics DNS: host=%s, port=%s, resolved=%s",
                host,
                port,
                resolved,
            )
        except Exception as e:
            logger.log(
                level,
                "Gateway diagnostics DNS failed: host=%s, error=%s: %s",
                host,
                type(e).__name__,
                e,
            )

        try:
            with socket.create_connection((host, port), timeout=3) as sock:
                local_host, local_port = sock.getsockname()[:2]
                remote_host, remote_port = sock.getpeername()[:2]
            logger.log(
                level,
                "Gateway diagnostics socket ok: url=%s, local=%s:%s, remote=%s:%s",
                url,
                local_host,
                local_port,
                remote_host,
                remote_port,
            )
        except Exception as e:
            logger.log(
                level,
                "Gateway diagnostics socket failed: url=%s, error=%s: %s",
                url,
                type(e).__name__,
                e,
            )

        probe_url = f"{url.rstrip('/')}/health"
        try:
            with httpx.Client(timeout=httpx.Timeout(5.0, connect=2.0), trust_env=False) as client:
                response = client.get(probe_url)
            logger.log(
                level,
                "Gateway diagnostics httpx probe: url=%s, status=%s, body=%r",
                probe_url,
                response.status_code,
                response.text[:300],
            )
        except Exception as e:
            logger.log(
                level,
                "Gateway diagnostics httpx failed: url=%s, error=%s: %s",
                probe_url,
                type(e).__name__,
                e,
            )

    logger.log(level, "Gateway network diagnostics end: reason=%s", reason)

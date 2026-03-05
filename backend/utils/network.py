"""
Network utilities: trusted proxy resolution and real client IP extraction.
Extracted from main.py to break circular import (main → routers → main).
"""
import os
import logging
from ipaddress import ip_address, ip_network
from fastapi import Request

logger = logging.getLogger("fot.network")

TRUSTED_PROXY_IPS = os.environ.get("TRUSTED_PROXY_IPS", "127.0.0.1,::1")


def _parse_trusted_proxy_networks(raw_value: str):
    networks = []
    for token in [item.strip() for item in raw_value.split(",") if item.strip()]:
        try:
            if "/" in token:
                networks.append(ip_network(token, strict=False))
            elif ":" in token:
                networks.append(ip_network(f"{token}/128", strict=False))
            else:
                networks.append(ip_network(f"{token}/32", strict=False))
        except ValueError:
            logger.warning("Ignoring invalid TRUSTED_PROXY_IPS entry: %s", token)
    return networks


TRUSTED_PROXY_NETWORKS = _parse_trusted_proxy_networks(TRUSTED_PROXY_IPS)


def _is_trusted_proxy(client_host: str) -> bool:
    try:
        client_ip = ip_address(client_host)
    except ValueError:
        return False
    return any(client_ip in network for network in TRUSTED_PROXY_NETWORKS)


def get_client_ip(request: Request) -> str:
    """Extract real client IP, trusting proxy headers only from trusted proxies."""
    client_host = request.client.host if request.client else "unknown"
    if client_host == "unknown":
        return client_host

    if not _is_trusted_proxy(client_host):
        return client_host

    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        candidate = forwarded.split(",")[0].strip()
        try:
            ip_address(candidate)
            return candidate
        except ValueError:
            logger.warning(
                "Ignoring invalid X-Forwarded-For from trusted proxy",
                extra={"proxy_ip": client_host, "value": forwarded},
            )

    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        candidate = real_ip.strip()
        try:
            ip_address(candidate)
            return candidate
        except ValueError:
            logger.warning(
                "Ignoring invalid X-Real-IP from trusted proxy",
                extra={"proxy_ip": client_host, "value": real_ip},
            )

    return client_host

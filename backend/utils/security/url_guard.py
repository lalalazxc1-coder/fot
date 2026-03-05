import ipaddress
import os
from typing import Sequence
from urllib.parse import SplitResult, urlsplit, urlunsplit


_ALLOWED_SCHEMES = {"http", "https"}
_LOCAL_HOSTS = {"localhost", "localhost.localdomain"}
_DEFAULT_ALLOWLIST: dict[str, tuple[str, ...]] = {
    "openai": ("api.openai.com", "api.openrouter.ai", "openrouter.ai", "api.deepseek.com"),
    "hh": ("api.hh.ru", "hh.ru"),
}


class UnsafeOutboundUrlError(ValueError):
    pass


def _is_truthy(value: str | None) -> bool:
    return bool(value and value.strip().lower() in {"1", "true", "yes", "on"})


def _split_csv(raw_value: str | None) -> list[str]:
    if not raw_value:
        return []
    return [item.strip() for item in raw_value.split(",") if item.strip()]


def _normalize_allowlist_entry(entry: str) -> str:
    token = entry.strip().lower()
    if not token:
        return ""

    try:
        return str(ipaddress.ip_network(token, strict=False))
    except ValueError:
        pass

    parsed = urlsplit(token if "://" in token else f"//{token}")
    if parsed.hostname:
        host = parsed.hostname.strip().lower().rstrip(".")
        if ":" in host and not host.startswith("["):
            return host
        return host

    return token.rstrip(".")


def _load_allowlist(service_name: str) -> list[str]:
    service_key = f"INTEGRATION_URL_ALLOWLIST_{service_name.upper()}"
    service_entries = [_normalize_allowlist_entry(i) for i in _split_csv(os.environ.get(service_key))]
    service_entries = [i for i in service_entries if i]
    if service_entries:
        return service_entries

    global_entries = [_normalize_allowlist_entry(i) for i in _split_csv(os.environ.get("INTEGRATION_URL_ALLOWLIST"))]
    global_entries = [i for i in global_entries if i]
    if global_entries:
        return global_entries

    return list(_DEFAULT_ALLOWLIST.get(service_name, ()))


def _allow_private_targets(service_name: str) -> bool:
    service_key = f"INTEGRATION_ALLOW_PRIVATE_TARGETS_{service_name.upper()}"
    service_value = os.environ.get(service_key)
    if service_value is not None:
        return _is_truthy(service_value)
    return _is_truthy(os.environ.get("INTEGRATION_ALLOW_PRIVATE_TARGETS"))


def _parse_ip(host: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address | None:
    try:
        return ipaddress.ip_address(host)
    except ValueError:
        return None


def _is_private_or_local_ip(ip_obj: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return bool(
        ip_obj.is_private
        or ip_obj.is_loopback
        or ip_obj.is_link_local
        or ip_obj.is_reserved
        or ip_obj.is_multicast
        or ip_obj.is_unspecified
    )


def _is_hostname_allowed(host: str, allowlist: Sequence[str]) -> bool:
    for entry in allowlist:
        if not entry:
            continue
        if entry.startswith("*."):
            suffix = entry[1:]
            if host.endswith(suffix):
                return True
            continue
        if entry.startswith("."):
            if host.endswith(entry):
                return True
            continue
        if host == entry:
            return True
    return False


def _is_ip_allowed(ip_obj: ipaddress.IPv4Address | ipaddress.IPv6Address, allowlist: Sequence[str]) -> bool:
    for entry in allowlist:
        if not entry:
            continue
        try:
            if ip_obj in ipaddress.ip_network(entry, strict=False):
                return True
            continue
        except ValueError:
            pass

        try:
            if ip_obj == ipaddress.ip_address(entry):
                return True
        except ValueError:
            continue
    return False


def _format_netloc(parsed: SplitResult, host: str) -> str:
    host_part = host
    if ":" in host_part and not host_part.startswith("["):
        host_part = f"[{host_part}]"
    if parsed.port:
        return f"{host_part}:{parsed.port}"
    return host_part


def validate_outbound_base_url(base_url: str, service_name: str) -> str:
    raw_url = (base_url or "").strip()
    if not raw_url:
        raise UnsafeOutboundUrlError("Base URL is required")

    parsed = urlsplit(raw_url)
    scheme = parsed.scheme.lower()
    if scheme not in _ALLOWED_SCHEMES:
        raise UnsafeOutboundUrlError("Only http/https URLs are allowed")

    if parsed.username or parsed.password:
        raise UnsafeOutboundUrlError("Credentials in URL are not allowed")

    if not parsed.hostname:
        raise UnsafeOutboundUrlError("Invalid URL host")

    host = parsed.hostname.strip().lower().rstrip(".")
    if not host:
        raise UnsafeOutboundUrlError("Invalid URL host")

    if host in _LOCAL_HOSTS or host.endswith(".localhost"):
        raise UnsafeOutboundUrlError("Local addresses are not allowed")

    normalized_service = (service_name or "").strip().lower()
    allowlist = _load_allowlist(normalized_service)
    env = (os.environ.get("ENVIRONMENT") or "development").strip().lower()
    if env == "production" and not allowlist:
        raise UnsafeOutboundUrlError(f"Allowlist is required for service '{normalized_service}' in production")

    ip_obj = _parse_ip(host)
    if allowlist:
        if ip_obj:
            if not _is_ip_allowed(ip_obj, allowlist):
                raise UnsafeOutboundUrlError("Host is not in the integration allowlist")
        elif not _is_hostname_allowed(host, allowlist):
            raise UnsafeOutboundUrlError("Host is not in the integration allowlist")

    if ip_obj and _is_private_or_local_ip(ip_obj) and not _allow_private_targets(normalized_service):
        raise UnsafeOutboundUrlError("Private or local network addresses are blocked")

    clean_path = parsed.path.rstrip("/")
    netloc = _format_netloc(parsed, host)
    return urlunsplit((scheme, netloc, clean_path, "", ""))

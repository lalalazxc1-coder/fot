import asyncio
import time
from typing import Any, Mapping

import httpx
import requests
from requests import RequestException, Response


RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}


def request_with_retry(
    method: str,
    url: str,
    *,
    timeout: int | float,
    retries: int = 2,
    backoff_seconds: float = 0.1,
    **kwargs: Any,
) -> Response:
    last_exc: RequestException | None = None
    for attempt in range(retries + 1):
        try:
            response = requests.request(method=method, url=url, timeout=timeout, **kwargs)
        except RequestException as exc:
            last_exc = exc
            if attempt >= retries:
                raise
        else:
            if response.status_code not in RETRYABLE_STATUS_CODES or attempt >= retries:
                return response

        time.sleep(backoff_seconds * (2 ** attempt))

    if last_exc is not None:
        raise last_exc
    raise RuntimeError("request_with_retry exhausted without response")


async def async_get_with_retry(
    url: str,
    *,
    params: Mapping[str, Any] | None = None,
    headers: Mapping[str, str] | None = None,
    timeout: httpx.Timeout | float = 10.0,
    retries: int = 2,
    backoff_seconds: float = 0.1,
) -> httpx.Response:
    async with httpx.AsyncClient(timeout=timeout) as client:
        last_exc: httpx.RequestError | None = None
        for attempt in range(retries + 1):
            try:
                response = await client.get(url, params=params, headers=headers)
            except httpx.RequestError as exc:
                last_exc = exc
                if attempt >= retries:
                    raise
            else:
                if response.status_code not in RETRYABLE_STATUS_CODES or attempt >= retries:
                    return response

            await asyncio.sleep(backoff_seconds * (2 ** attempt))

    if last_exc is not None:
        raise last_exc
    raise RuntimeError("async_get_with_retry exhausted without response")

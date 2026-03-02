"""Security hardening tests from deep audit remediation plan."""

import pytest
from main import _get_client_ip


def test_positions_read_requires_explicit_permission(client, viewer_headers):
    resp = client.get("/api/positions/", headers=viewer_headers)
    assert resp.status_code == 403
    assert "view_positions" in resp.json()["detail"]


def test_scenarios_list_requires_explicit_permission(client, viewer_headers):
    resp = client.get("/api/scenarios/", headers=viewer_headers)
    assert resp.status_code == 403
    assert "view_scenarios" in resp.json()["detail"]


def test_scenarios_comparison_requires_explicit_permission(client, viewer_headers):
    resp = client.get("/api/scenarios/1/comparison", headers=viewer_headers)
    assert resp.status_code == 403
    assert "view_scenarios" in resp.json()["detail"]


def test_scenarios_create_requires_explicit_permission(client, viewer_headers):
    resp = client.post(
        "/api/scenarios/",
        headers=viewer_headers,
        json={"name": "No Access Scenario", "description": "Should fail"},
    )
    assert resp.status_code == 403
    assert "view_scenarios" in resp.json()["detail"]


def test_scenarios_delete_requires_explicit_permission(client, viewer_headers):
    resp = client.delete("/api/scenarios/1", headers=viewer_headers)
    assert resp.status_code == 403
    assert "view_scenarios" in resp.json()["detail"]


def test_scenarios_apply_change_requires_explicit_permission(client, viewer_headers):
    resp = client.post(
        "/api/scenarios/1/apply-change",
        headers=viewer_headers,
        json={"field": "base_net", "change_type": "percent", "value": 10},
    )
    assert resp.status_code == 403
    assert "view_scenarios" in resp.json()["detail"]


def test_scenarios_commit_requires_explicit_permission(client, viewer_headers):
    resp = client.post("/api/scenarios/1/commit", headers=viewer_headers)
    assert resp.status_code == 403
    assert "view_scenarios" in resp.json()["detail"]


def test_salary_config_read_requires_admin_permission(client, viewer_headers):
    resp = client.get("/api/salary-config/", headers=viewer_headers)
    assert resp.status_code == 403
    assert "Admin access required" in resp.json()["detail"]


def test_salary_config_history_requires_admin_permission(client, viewer_headers):
    resp = client.get("/api/salary-config/history", headers=viewer_headers)
    assert resp.status_code == 403
    assert "Admin access required" in resp.json()["detail"]


def test_forwarded_headers_ignored_for_untrusted_proxy():
    class _Req:
        class _Client:
            host = "203.0.113.10"

        client = _Client()
        headers = {"X-Forwarded-For": "1.2.3.4", "X-Real-IP": "5.6.7.8"}

    assert _get_client_ip(_Req()) == "203.0.113.10"


def test_forwarded_headers_used_for_trusted_proxy(monkeypatch):
    from ipaddress import ip_network
    import main

    monkeypatch.setattr(main, "TRUSTED_PROXY_NETWORKS", [ip_network("127.0.0.1/32")])

    class _Req:
        class _Client:
            host = "127.0.0.1"

        client = _Client()
        headers = {"X-Forwarded-For": "1.2.3.4, 127.0.0.1"}

    assert _get_client_ip(_Req()) == "1.2.3.4"


def test_planning_export_hides_internal_exception_details(client, auth_headers, planning_position, monkeypatch):
    from routers import planning as planning_router

    def _broken_save(*args, **kwargs):
        raise RuntimeError("super-secret-export-error")

    monkeypatch.setattr(planning_router.Workbook, "save", _broken_save)

    resp = client.post("/api/planning/export", headers=auth_headers, json={})
    assert resp.status_code == 500
    payload = resp.json()
    assert payload["detail"] == "Export failed. Please try again later."
    assert "super-secret-export-error" not in resp.text


@pytest.mark.parametrize(
    "hh_status, expected_status, expected_detail",
    [
        (429, 429, "HH API rate limit reached. Please try again later."),
        (503, 502, "HH API temporarily unavailable. Please try again later."),
        (400, 502, "HH API request failed. Please try again later."),
    ],
)
def test_market_sync_hh_sanitizes_upstream_errors(
    client,
    auth_headers,
    monkeypatch,
    hh_status,
    expected_status,
    expected_detail,
):
    from routers import market as market_router

    class _FakeResponse:
        def __init__(self, status_code: int, text: str):
            self.status_code = status_code
            self.text = text

        def json(self):
            return {"items": []}

    async def _fake_get(*args, **kwargs):
        return _FakeResponse(hh_status, "upstream-internal-debug-body")

    monkeypatch.setattr(market_router.httpx.AsyncClient, "get", _fake_get)

    create_resp = client.post(
        "/api/market",
        headers=auth_headers,
        json={"position_title": f"Audit Position {hh_status}"},
    )
    assert create_resp.status_code == 200
    market_id = create_resp.json()["id"]

    sync_resp = client.post(f"/api/market/{market_id}/sync-hh", headers=auth_headers)

    assert sync_resp.status_code == expected_status
    payload = sync_resp.json()
    assert payload["detail"] == expected_detail
    assert "upstream-internal-debug-body" not in sync_resp.text

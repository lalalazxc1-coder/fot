"""Security hardening tests from deep audit remediation plan."""

import pytest
import importlib
import sys
from typing import Any, cast
from main import _get_client_ip
from utils.secret_store import decrypt_secret


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
    assert "manage_planning" in resp.json()["detail"]


def test_scenarios_delete_requires_explicit_permission(client, viewer_headers):
    resp = client.delete("/api/scenarios/1", headers=viewer_headers)
    assert resp.status_code == 403
    assert "manage_planning" in resp.json()["detail"]


def test_scenarios_apply_change_requires_explicit_permission(client, viewer_headers):
    resp = client.post(
        "/api/scenarios/1/apply-change",
        headers=viewer_headers,
        json={"field": "base_net", "change_type": "percent", "value": 10},
    )
    assert resp.status_code == 403
    assert "manage_planning" in resp.json()["detail"]


def test_scenarios_commit_requires_explicit_permission(client, viewer_headers):
    resp = client.post("/api/scenarios/1/commit", headers=viewer_headers)
    assert resp.status_code == 403
    assert "manage_planning" in resp.json()["detail"]


def test_scenarios_write_denied_for_view_scenarios_only_user(client, scenarios_viewer_headers):
    resp = client.post(
        "/api/scenarios/",
        headers=scenarios_viewer_headers,
        json={"name": "View only user should not write"},
    )
    assert resp.status_code == 403
    assert "manage_planning" in resp.json()["detail"]


def test_salary_config_read_requires_admin_permission(client, viewer_headers):
    resp = client.get("/api/salary-config/", headers=viewer_headers)
    assert resp.status_code == 403
    assert "Admin access required" in resp.json()["detail"]


def test_salary_config_history_requires_admin_permission(client, viewer_headers):
    resp = client.get("/api/salary-config/history", headers=viewer_headers)
    assert resp.status_code == 403
    assert "Admin access required" in resp.json()["detail"]


def test_salary_config_calculate_requires_authentication(client):
    resp = client.post(
        "/api/salary-config/calculate",
        json={"amount": 100000, "type": "gross"},
    )
    assert resp.status_code in (401, 403)


def test_integration_secrets_are_encrypted_at_rest(client, auth_headers, integration_settings, db):
    from database.models import IntegrationSettings

    resp = client.get("/api/integrations/settings", headers=auth_headers)
    assert resp.status_code == 200

    openai_row = db.query(IntegrationSettings).filter(IntegrationSettings.service_name == "openai").first()
    hh_row = db.query(IntegrationSettings).filter(IntegrationSettings.service_name == "hh").first()

    assert openai_row is not None
    assert hh_row is not None

    assert str(openai_row.api_key).startswith("enc:")
    assert str(hh_row.client_secret).startswith("enc:")
    assert decrypt_secret(openai_row.api_key) == "openai-key"
    assert decrypt_secret(hh_row.client_secret) == "hh-secret"


def test_forwarded_headers_ignored_for_untrusted_proxy():
    class _Req:
        class _Client:
            host = "203.0.113.10"

        client = _Client()
        headers = {"X-Forwarded-For": "1.2.3.4", "X-Real-IP": "5.6.7.8"}

    assert _get_client_ip(cast(Any, _Req())) == "203.0.113.10"


def test_forwarded_headers_used_for_trusted_proxy(monkeypatch):
    from ipaddress import ip_network
    import main

    monkeypatch.setattr(main, "TRUSTED_PROXY_NETWORKS", [ip_network("127.0.0.1/32")])

    class _Req:
        class _Client:
            host = "127.0.0.1"

        client = _Client()
        headers = {"X-Forwarded-For": "1.2.3.4, 127.0.0.1"}

    assert _get_client_ip(cast(Any, _Req())) == "1.2.3.4"


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

    async def _fake_async_get_with_retry(*args, **kwargs):
        return _FakeResponse(hh_status, "upstream-internal-debug-body")

    monkeypatch.setattr(market_router, "async_get_with_retry", _fake_async_get_with_retry)

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


def test_secret_key_required_in_production(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SECRET_KEY", "")
    monkeypatch.setenv("FOT_SECRET_KEY", "")
    monkeypatch.delenv("SECRETS_ENCRYPTION_KEY", raising=False)

    module_name = "security"
    original = sys.modules.get(module_name)
    sys.modules.pop(module_name, None)

    with pytest.raises(RuntimeError, match="SECRET_KEY is required in production"):
        importlib.import_module(module_name)

    if original is not None:
        sys.modules[module_name] = original
    else:
        sys.modules.pop(module_name, None)


def test_secrets_encryption_key_required_in_production(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("SECRETS_ENCRYPTION_KEY", raising=False)
    monkeypatch.setenv("SECRET_KEY", "fallback-not-allowed-in-prod")

    with pytest.raises(RuntimeError, match="SECRETS_ENCRYPTION_KEY is required in production"):
        decrypt_secret("enc:gAAAAABinvalid-token")


@pytest.mark.parametrize("service_name", ["openai", "onec"])
def test_test_connection_rejects_private_base_url(client, auth_headers, service_name):
    payload = {
        "service_name": service_name,
        "base_url": "http://127.0.0.1:8000/internal",
    }
    if service_name == "openai":
        payload["api_key"] = "test-key"

    resp = client.post("/api/integrations/test-connection", headers=auth_headers, json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is False
    assert "Некорректный Base URL" in data["message"]


def test_update_settings_rejects_private_base_url(client, auth_headers):
    resp = client.post(
        "/api/integrations/settings",
        headers=auth_headers,
        json={
            "service_name": "openai",
            "is_active": True,
            "additional_params": {"base_url": "http://127.0.0.1:11434/v1"},
        },
    )
    assert resp.status_code == 400
    assert "Некорректный Base URL" in resp.json()["detail"]


def test_openai_test_connection_rejects_bad_scheme(client, auth_headers):
    resp = client.post(
        "/api/integrations/test-connection",
        headers=auth_headers,
        json={
            "service_name": "openai",
            "api_key": "test-key",
            "base_url": "file:///etc/passwd",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is False
    assert "Некорректный Base URL" in body["message"]


def test_ai_analyze_rejects_private_base_url(client, auth_headers, integration_settings, db):
    from database.models import IntegrationSettings

    openai_row = db.query(IntegrationSettings).filter(IntegrationSettings.service_name == "openai").first()
    assert openai_row is not None
    openai_row.additional_params = {"base_url": "http://127.0.0.1:11434/v1"}
    db.commit()

    resp = client.post(
        "/api/integrations/ai-analyze",
        headers=auth_headers,
        json={"candidate_data": {"name": "Ivan"}, "job_description": "Python"},
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Некорректный Base URL AI-интеграции."

"""Tests for CSRF protection with cookie-based auth."""


def test_csrf_endpoint_sets_cookie(client):
    resp = client.get("/api/auth/csrf")
    assert resp.status_code == 200
    assert resp.json().get("csrf_token")
    assert resp.cookies.get("csrf_token")


def test_mutating_endpoint_rejects_cookie_auth_without_csrf(client, auth_headers):
    client.cookies.pop("csrf_token", None)

    resp = client.post("/api/auth/notifications/read-all", headers={})
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Invalid CSRF token"


def test_mutating_endpoint_allows_cookie_auth_with_csrf_header(client, auth_headers):
    csrf = client.cookies.get("csrf_token")
    assert csrf

    resp = client.post(
        "/api/auth/notifications/read-all",
        headers={"X-CSRF-Token": csrf},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_mutating_endpoint_allows_bearer_auth_without_csrf(client, auth_headers):
    bearer_token = auth_headers.get("Authorization")
    assert bearer_token
    client.cookies.clear()

    resp = client.post(
        "/api/auth/notifications/read-all",
        headers={"Authorization": bearer_token},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"

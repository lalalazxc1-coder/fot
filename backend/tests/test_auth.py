"""
Tests for Auth system: login, /me, change-password.
"""

from jose import jwt

from security import ALGORITHM, REFRESH_SECRET_KEY


def _decode_refresh_cookie(resp):
    token = resp.cookies.get("refresh_token")
    assert token
    return token, jwt.decode(token, REFRESH_SECRET_KEY, algorithms=[ALGORITHM])

def test_login_success(client, admin_user):
    resp = client.post("/api/auth/login", json={
        "username": "admin@test.com",
        "password": "admin123"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["full_name"] == "Test Admin"
    assert data["role"] == "Administrator"
    assert data["email"] == "admin@test.com"
    assert data.get("contact_email") is None
    assert data.get("phone") is None
    assert "access_token" not in data

    cookies = resp.cookies
    assert cookies.get("access_token")
    assert cookies.get("refresh_token")
    assert cookies.get("csrf_token")


def test_login_wrong_password(client, admin_user):
    resp = client.post("/api/auth/login", json={
        "username": "admin@test.com",
        "password": "wrongpassword"
    })
    assert resp.status_code == 400


def test_login_nonexistent_user(client):
    resp = client.post("/api/auth/login", json={
        "username": "nobody@test.com",
        "password": "pass"
    })
    assert resp.status_code == 400


def test_get_me(client, auth_headers):
    resp = client.get("/api/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "admin@test.com"
    assert data["role"] == "Administrator"
    assert "permissions" in data
    assert data["avatar_url"] is None
    assert data["job_title"] is None
    assert data["contact_email"] is None
    assert data["phone"] is None


def test_get_me_unauthorized(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code in (401, 403)


def test_change_password_success(client, auth_headers):
    resp = client.post("/api/auth/change-password", headers=auth_headers, json={
        "old_password": "admin123",
        "new_password": "newpass123"
    })
    assert resp.status_code == 200

    # Login with new password
    resp2 = client.post("/api/auth/login", json={
        "username": "admin@test.com",
        "password": "newpass123"
    })
    assert resp2.status_code == 200


def test_change_password_wrong_old(client, auth_headers):
    resp = client.post("/api/auth/change-password", headers=auth_headers, json={
        "old_password": "wrongold",
        "new_password": "newpass123"
    })
    assert resp.status_code == 400


def test_refresh_rotates_refresh_token(client, admin_user):
    login_resp = client.post(
        "/api/auth/login",
        json={"username": "admin@test.com", "password": "admin123"},
    )
    assert login_resp.status_code == 200

    old_refresh, old_payload = _decode_refresh_cookie(login_resp)

    refresh_resp = client.post("/api/auth/refresh", headers={"X-CSRF-Token": client.cookies.get("csrf_token") or ""})
    assert refresh_resp.status_code == 200

    new_refresh, new_payload = _decode_refresh_cookie(refresh_resp)
    assert new_refresh != old_refresh
    assert new_payload["sid"] == old_payload["sid"]
    assert new_payload["jti"] != old_payload["jti"]


def test_refresh_reuse_detection_revokes_session(client, admin_user):
    login_resp = client.post(
        "/api/auth/login",
        json={"username": "admin@test.com", "password": "admin123"},
    )
    assert login_resp.status_code == 200

    old_refresh, _ = _decode_refresh_cookie(login_resp)
    csrf = client.cookies.get("csrf_token") or ""

    first_refresh = client.post("/api/auth/refresh", headers={"X-CSRF-Token": csrf})
    assert first_refresh.status_code == 200
    new_refresh = first_refresh.cookies.get("refresh_token")
    assert new_refresh

    client.cookies.set("refresh_token", old_refresh)
    reuse_resp = client.post("/api/auth/refresh", headers={"X-CSRF-Token": csrf})
    assert reuse_resp.status_code == 401
    assert reuse_resp.json()["detail"] == "Refresh token reuse detected"

    client.cookies.set("refresh_token", new_refresh)
    after_revoke_resp = client.post("/api/auth/refresh", headers={"X-CSRF-Token": csrf})
    assert after_revoke_resp.status_code == 401
    assert after_revoke_resp.json()["detail"] == "Refresh session has been revoked"


def test_logout_revokes_refresh_session(client, admin_user):
    login_resp = client.post(
        "/api/auth/login",
        json={"username": "admin@test.com", "password": "admin123"},
    )
    assert login_resp.status_code == 200

    csrf = client.cookies.get("csrf_token") or ""
    logout_resp = client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    assert logout_resp.status_code == 200

    refresh_resp = client.post("/api/auth/refresh", headers={"X-CSRF-Token": csrf})
    assert refresh_resp.status_code == 401


def test_update_my_profile(client, auth_headers):
    resp = client.put(
        "/api/users/me/profile",
        headers=auth_headers,
        json={
            "full_name": "Updated Admin",
            "job_title": "HR Director",
            "contact_email": "me@example.com",
            "phone": "+77001234567",
        },
    )
    assert resp.status_code == 200

    data = resp.json()
    assert data["full_name"] == "Updated Admin"
    assert data["job_title"] == "HR Director"
    assert data["contact_email"] == "me@example.com"
    assert data["phone"] == "+77001234567"


def test_upload_my_avatar(client, auth_headers):
    files = {"file": ("avatar.png", b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR", "image/png")}
    resp = client.post("/api/users/me/avatar", headers=auth_headers, files=files)
    assert resp.status_code == 200

    data = resp.json()
    assert data["avatar_url"].startswith("/uploads/avatars/user_")


def test_delete_my_avatar(client, auth_headers):
    files = {"file": ("avatar.png", b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR", "image/png")}
    upload = client.post("/api/users/me/avatar", headers=auth_headers, files=files)
    assert upload.status_code == 200
    assert upload.json()["avatar_url"] is not None

    resp = client.delete("/api/users/me/avatar", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["avatar_url"] is None

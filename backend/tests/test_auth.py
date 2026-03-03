"""
Tests for Auth system: login, /me, change-password.
"""

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

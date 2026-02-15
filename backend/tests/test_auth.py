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
    assert "access_token" in data


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

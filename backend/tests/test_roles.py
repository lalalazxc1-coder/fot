"""
Tests for Roles API: list, create.
"""


def test_list_roles(client, auth_headers, admin_role):
    resp = client.get("/api/roles", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert any(r["name"] == "Administrator" for r in data)


def test_create_role(client, auth_headers):
    resp = client.post("/api/roles", headers=auth_headers, json={
        "name": "Manager",
        "permissions": {"view_structure": True, "manage_planning": True}
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["id"] > 0

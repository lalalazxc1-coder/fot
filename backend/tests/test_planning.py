"""
Tests for Planning API: CRUD for planning positions, export.
"""


def test_get_planning(client, auth_headers, planning_position):
    resp = client.get("/api/planning", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1


def test_create_planning_position(client, auth_headers, org_structure, salary_config):
    resp = client.post("/api/planning", headers=auth_headers, json={
        "position": "Бухгалтер",
        "branch_id": org_structure["branch"].id,
        "department_id": org_structure["department"].id,
        "schedule": "5/2",
        "count": 2,
        "base_net": 200000,
        "base_gross": 270000,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["id"] > 0


def test_update_planning_position(client, auth_headers, planning_position, salary_config):
    pp_id = planning_position.id
    resp = client.patch(f"/api/planning/{pp_id}", headers=auth_headers, json={
        "count": 5
    })
    assert resp.status_code == 200
    assert resp.json()["status"] == "updated"


def test_delete_planning_position(client, auth_headers, planning_position):
    pp_id = planning_position.id
    resp = client.delete(f"/api/planning/{pp_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "deleted"


def test_planning_export_excel(client, auth_headers, planning_position):
    resp = client.get("/api/planning/export", headers=auth_headers)
    assert resp.status_code == 200
    assert "spreadsheet" in resp.headers.get("content-type", "")

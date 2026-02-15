"""
Tests for Organization Structure: CRUD for head_office, branches, departments.
"""


def test_create_head_office(client, auth_headers):
    resp = client.post("/api/structure/head_office", headers=auth_headers, json={
        "name": "Главный офис",
        "type": "head_office"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["id"] > 0


def test_create_branch_under_head(client, auth_headers, org_structure):
    resp = client.post("/api/structure/branch", headers=auth_headers, json={
        "name": "Филиал Астана",
        "type": "branch",
        "parent_id": org_structure["head"].id
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


def test_create_department(client, auth_headers, org_structure):
    resp = client.post("/api/structure/department", headers=auth_headers, json={
        "name": "HR Отдел",
        "type": "department",
        "parent_id": org_structure["branch"].id
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


def test_get_structure_tree(client, auth_headers, org_structure):
    resp = client.get("/api/structure/", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1


def test_get_structure_flat(client, auth_headers, org_structure):
    resp = client.get("/api/structure/flat", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    # 3 units: head, branch, department
    assert len(data) >= 3
    types = {item["type"] for item in data}
    assert "head_office" in types
    assert "branch" in types
    assert "department" in types


def test_update_unit_name(client, auth_headers, org_structure):
    branch_id = org_structure["branch"].id
    resp = client.patch(f"/api/structure/{branch_id}", headers=auth_headers, json={
        "name": "Филиал Алматы (обновлён)"
    })
    assert resp.status_code == 200


def test_delete_unit(client, auth_headers, org_structure):
    dept_id = org_structure["department"].id
    resp = client.delete(f"/api/structure/{dept_id}", headers=auth_headers)
    assert resp.status_code == 200

    # Verify it's gone from flat list
    flat = client.get("/api/structure/flat", headers=auth_headers).json()
    dept_ids = [item["id"] for item in flat]
    assert dept_id not in dept_ids

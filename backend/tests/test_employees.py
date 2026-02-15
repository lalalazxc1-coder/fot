"""
Tests for Employees API: list, export.
"""


def test_get_employees(client, auth_headers, employee):
    resp = client.get("/api/employees", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    emp = data[0]
    assert emp["full_name"] == "Иванов Иван"


def test_get_employees_unauthorized(client):
    resp = client.get("/api/employees")
    assert resp.status_code in (401, 403)


def test_export_employees_excel(client, auth_headers, employee):
    resp = client.get("/api/employees/export", headers=auth_headers)
    assert resp.status_code == 200
    assert "spreadsheet" in resp.headers.get("content-type", "")
    assert len(resp.content) > 0

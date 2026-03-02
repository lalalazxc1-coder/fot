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


def test_get_employees_prefers_last_raise_date(client, auth_headers, employee, db):
    from database.models import FinancialRecord

    fin = db.query(FinancialRecord).filter(FinancialRecord.employee_id == employee.id).order_by(FinancialRecord.id.desc()).first()
    fin.last_raise_date = "2024-02-15T12:00:00"
    fin.created_at = "2023-01-01T12:00:00"
    db.commit()

    resp = client.get("/api/employees", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data[0]["last_raise_date"] == "2024-02-15"


def test_get_employees_unauthorized(client):
    resp = client.get("/api/employees")
    assert resp.status_code in (401, 403)


def test_export_employees_excel(client, auth_headers, employee):
    resp = client.post("/api/employees/export", headers=auth_headers, json={})
    assert resp.status_code == 200
    assert "spreadsheet" in resp.headers.get("content-type", "")
    assert len(resp.content) > 0

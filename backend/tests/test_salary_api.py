"""
Tests for Salary Config API: get, calculate endpoint.
Routes are at /api/salary-config/
"""


def test_get_salary_config(client, auth_headers, salary_config):
    resp = client.get("/api/salary-config/", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["mrp"] == 4325
    assert data["mzp"] == 85000


def test_get_salary_config_auto_creates(client, auth_headers, salary_config):
    """Config should be returnable (auto-created or pre-seeded)."""
    resp = client.get("/api/salary-config/", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["mrp"] > 0
    assert data["mzp"] > 0


def test_calculate_endpoint_gross(client, auth_headers, salary_config):
    resp = client.post("/api/salary-config/calculate", headers=auth_headers, json={
        "amount": 300000,
        "type": "gross"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["gross"] == 300000
    assert data["net"] > 0
    assert data["net"] < 300000
    assert "opv" in data
    assert "ipn" in data
    assert "osms" in data


def test_calculate_endpoint_net(client, auth_headers, salary_config):
    """Calculate from net — should reverse-solve to gross."""
    resp = client.post("/api/salary-config/calculate", headers=auth_headers, json={
        "amount": 200000,
        "type": "net"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["gross"] > 200000  # Gross > Net
    assert abs(data["net"] - 200000) < 1  # Should match target net

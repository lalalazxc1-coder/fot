def test_analytics_summary_happy_path(client, auth_headers):
    resp = client.get("/api/analytics/summary", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "fact" in data
    assert "plan" in data
    assert "metrics" in data


def test_analytics_summary_requires_auth(client):
    resp = client.get("/api/analytics/summary")
    assert resp.status_code in (401, 403)


def test_analytics_cost_distribution_happy_path(client, auth_headers, org_structure, employee, salary_config):
    resp = client.get("/api/analytics/cost-distribution", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "data" in data
    assert isinstance(data["data"], list)


def test_analytics_cost_distribution_requires_auth(client):
    resp = client.get("/api/analytics/cost-distribution")
    assert resp.status_code in (401, 403)


def test_analytics_turnover_happy_path(client, auth_headers):
    resp = client.get("/api/analytics/turnover", headers=auth_headers)
    assert resp.status_code == 200

    data = resp.json()
    assert "staffing_gaps" in data
    assert "turnover_rate" in data
    assert "dismissed_count" in data
    assert "reasons_distribution" in data


def test_analytics_employees_happy_path(client, auth_headers):
    resp = client.get("/api/analytics/employees", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_analytics_employees_requires_auth(client):
    resp = client.get("/api/analytics/employees")
    assert resp.status_code in (401, 403)

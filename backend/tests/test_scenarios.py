"""
Tests for Scenarios API: create, compare, mass-update, commit, delete.
"""


def test_create_scenario(client, auth_headers, planning_position):
    resp = client.post("/api/scenarios/", headers=auth_headers, json={
        "name": "Бюджет 2026 (Оптимистичный)",
        "description": "Рост на 10%"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] > 0
    assert data["cloned_positions"] >= 1


def test_list_scenarios(client, auth_headers, planning_position):
    # Create one first
    client.post("/api/scenarios/", headers=auth_headers, json={"name": "Test Scenario"})

    resp = client.get("/api/scenarios/", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["name"] == "Test Scenario"


def test_compare_scenario(client, auth_headers, planning_position, salary_config):
    # Create scenario
    create = client.post("/api/scenarios/", headers=auth_headers, json={"name": "Compare Test"})
    sc_id = create.json()["id"]

    resp = client.get(f"/api/scenarios/{sc_id}/comparison", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()

    assert "live" in data
    assert "scenario" in data
    assert "delta" in data
    assert data["live"]["total_net"] > 0
    assert data["scenario"]["total_net"] > 0
    # Initially the scenario is a clone, so deltas should be ~0
    assert data["delta"]["net"] == 0


def test_mass_update_scenario(client, auth_headers, planning_position, salary_config):
    # Create scenario
    create = client.post("/api/scenarios/", headers=auth_headers, json={"name": "Mass Update Test"})
    sc_id = create.json()["id"]

    # Apply +10% to base_net
    resp = client.post(f"/api/scenarios/{sc_id}/apply-change", headers=auth_headers, json={
        "field": "base_net",
        "change_type": "percent",
        "value": 10.0
    })
    assert resp.status_code == 200
    assert resp.json()["updated"] >= 1

    # Comparison should now show delta > 0
    comp = client.get(f"/api/scenarios/{sc_id}/comparison", headers=auth_headers).json()
    assert comp["scenario"]["total_net"] > comp["live"]["total_net"]


def test_mass_update_fixed_add(client, auth_headers, planning_position, salary_config):
    create = client.post("/api/scenarios/", headers=auth_headers, json={"name": "Fixed Add Test"})
    sc_id = create.json()["id"]

    resp = client.post(f"/api/scenarios/{sc_id}/apply-change", headers=auth_headers, json={
        "field": "base_net",
        "change_type": "fixed_add",
        "value": 50000
    })
    assert resp.status_code == 200
    assert resp.json()["updated"] >= 1


def test_mass_update_fixed_set(client, auth_headers, planning_position, salary_config):
    create = client.post("/api/scenarios/", headers=auth_headers, json={"name": "Fixed Set Test"})
    sc_id = create.json()["id"]

    resp = client.post(f"/api/scenarios/{sc_id}/apply-change", headers=auth_headers, json={
        "field": "base_net",
        "change_type": "fixed_set",
        "value": 500000
    })
    assert resp.status_code == 200


def test_mass_update_with_branch_filter(client, auth_headers, planning_position, salary_config, org_structure):
    create = client.post("/api/scenarios/", headers=auth_headers, json={"name": "Branch Filter Test"})
    sc_id = create.json()["id"]

    resp = client.post(f"/api/scenarios/{sc_id}/apply-change", headers=auth_headers, json={
        "field": "base_net",
        "change_type": "percent",
        "value": 5.0,
        "target_branch_id": org_structure["branch"].id
    })
    assert resp.status_code == 200


def test_commit_scenario(client, auth_headers, planning_position, salary_config):
    create = client.post("/api/scenarios/", headers=auth_headers, json={"name": "Commit Test"})
    sc_id = create.json()["id"]

    # Apply change first
    client.post(f"/api/scenarios/{sc_id}/apply-change", headers=auth_headers, json={
        "field": "base_net",
        "change_type": "percent",
        "value": 15.0
    })

    # Commit
    resp = client.post(f"/api/scenarios/{sc_id}/commit", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "committed"
    assert "backup_id" in data


def test_delete_scenario(client, auth_headers, planning_position):
    create = client.post("/api/scenarios/", headers=auth_headers, json={"name": "Delete Me"})
    sc_id = create.json()["id"]

    resp = client.delete(f"/api/scenarios/{sc_id}", headers=auth_headers)
    assert resp.status_code == 200

    # Verify it's gone
    scenarios = client.get("/api/scenarios/", headers=auth_headers).json()
    ids = [s["id"] for s in scenarios]
    assert sc_id not in ids


def test_delete_nonexistent_scenario(client, auth_headers):
    resp = client.delete("/api/scenarios/99999", headers=auth_headers)
    assert resp.status_code == 404

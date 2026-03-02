def _offer_payload():
    return {
        "candidate_name": "Test Candidate",
        "position_title": "Backend Engineer",
        "base_net": 300000,
        "kpi_net": 50000,
        "bonus_net": 10000,
    }


def test_job_offers_list_happy_path(client, auth_headers):
    create_resp = client.post("/api/offers/", headers=auth_headers, json=_offer_payload())
    assert create_resp.status_code == 200

    list_resp = client.get("/api/offers/", headers=auth_headers)
    assert list_resp.status_code == 200
    data = list_resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_job_offers_list_requires_auth(client):
    resp = client.get("/api/offers/")
    assert resp.status_code in (401, 403)


def test_job_offers_public_preview_happy_path(client, auth_headers):
    create_resp = client.post("/api/offers/", headers=auth_headers, json=_offer_payload())
    assert create_resp.status_code == 200
    token = create_resp.json()["token"]

    preview_resp = client.get(f"/api/offers/public/{token}")
    assert preview_resp.status_code == 200
    payload = preview_resp.json()
    assert payload["is_locked"] is True
    assert payload["token"] == token


def test_job_offers_rejects_invalid_theme_color(client, auth_headers):
    payload = {
        **_offer_payload(),
        "theme_color": "#12abz9",
    }

    resp = client.post("/api/offers/", headers=auth_headers, json=payload)

    assert resp.status_code == 422

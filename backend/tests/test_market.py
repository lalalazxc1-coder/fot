def test_market_create_and_list_happy_path(client, auth_headers):
    create_resp = client.post(
        "/api/market",
        headers=auth_headers,
        json={"position_title": "QA Engineer", "source": "Manual"},
    )
    assert create_resp.status_code == 200

    list_resp = client.get("/api/market", headers=auth_headers)
    assert list_resp.status_code == 200
    data = list_resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_market_requires_auth(client):
    resp = client.get("/api/market")
    assert resp.status_code in (401, 403)


def test_market_sync_hh_happy_path_with_mock(client, auth_headers, monkeypatch):
    from routers import market as market_router

    class _FakeResponse:
        status_code = 200

        def json(self):
            return {
                "items": [
                    {
                        "salary": {"from": 300000, "to": 500000, "currency": "KZT"},
                        "employer": {"name": "ACME"},
                        "alternate_url": "https://example.com/vacancy/1",
                    }
                ]
            }

    async def _fake_async_get_with_retry(*args, **kwargs):
        return _FakeResponse()

    monkeypatch.setattr(market_router, "async_get_with_retry", _fake_async_get_with_retry)

    create_resp = client.post(
        "/api/market",
        headers=auth_headers,
        json={"position_title": "Python Developer"},
    )
    assert create_resp.status_code == 200
    market_id = create_resp.json()["id"]

    sync_resp = client.post(f"/api/market/{market_id}/sync-hh", headers=auth_headers)
    assert sync_resp.status_code == 200
    payload = sync_resp.json()
    assert payload["count"] >= 1


def test_market_sync_hh_requires_auth(client):
    resp = client.post("/api/market/1/sync-hh")
    assert resp.status_code in (401, 403)

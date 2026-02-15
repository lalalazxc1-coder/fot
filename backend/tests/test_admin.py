"""
Tests for Admin API: /api/admin/stats (requires admin role).
"""


def test_admin_stats(client, auth_headers, admin_user):
    resp = client.get("/api/admin/stats", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "counts" in data
    assert "budget" in data
    assert "activity" in data
    assert "charts" in data
    assert data["counts"]["users"] >= 1


def test_admin_stats_unauthorized(client, viewer_headers):
    """Viewer should not have admin access."""
    resp = client.get("/api/admin/stats", headers=viewer_headers)
    assert resp.status_code == 403

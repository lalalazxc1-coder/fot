"""
Tests for Notifications API: get, mark read, mark all read, delete all.
"""


def test_get_notifications_empty(client, auth_headers):
    resp = client.get("/api/auth/notifications", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_notifications_full_cycle(client, auth_headers, admin_user, db):
    from database.models import Notification
    from datetime import datetime

    # Seed notifications
    for i in range(3):
        n = Notification(
            user_id=admin_user.id,
            message=f"Уведомление {i+1}",
            is_read=False,
            created_at=datetime.now().isoformat(),
        )
        db.add(n)
    db.commit()

    # Get — should have 3 unread
    resp = client.get("/api/auth/notifications", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 3

    # Mark one as read
    nid = data[0]["id"]
    resp2 = client.patch(f"/api/auth/notifications/{nid}/read", headers=auth_headers)
    assert resp2.status_code == 200

    # Now 2 unread
    resp3 = client.get("/api/auth/notifications", headers=auth_headers)
    unread = [n for n in resp3.json() if not n["is_read"]]
    assert len(unread) == 2

    # Mark all as read
    resp4 = client.post("/api/auth/notifications/read-all", headers=auth_headers)
    assert resp4.status_code == 200

    resp5 = client.get("/api/auth/notifications", headers=auth_headers)
    unread2 = [n for n in resp5.json() if not n["is_read"]]
    assert len(unread2) == 0

    # Delete all
    resp6 = client.delete("/api/auth/notifications", headers=auth_headers)
    assert resp6.status_code == 200

    resp7 = client.get("/api/auth/notifications", headers=auth_headers)
    assert len(resp7.json()) == 0

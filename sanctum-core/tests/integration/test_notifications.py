def test_notification_flow(client, admin_token_headers, db):
    # 1. Manually create a notification in DB for the admin user
    from app.models import User, Notification
    user = db.query(User).filter(User.email == "testadmin@sanctum.com").first()
    
    notif = Notification(
        user_id=user.id,
        title="Test Alert",
        message="System check"
    )
    db.add(notif)
    db.commit()

    # 2. Fetch via API
    response = client.get("/notifications", headers=admin_token_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert data[0]["title"] == "Test Alert"
    
    # 3. Mark as Read
    nid = data[0]["id"]
    res = client.put(f"/notifications/{nid}", headers=admin_token_headers, json={"is_read": True})
    assert res.status_code == 200
    assert res.json()["is_read"] is True
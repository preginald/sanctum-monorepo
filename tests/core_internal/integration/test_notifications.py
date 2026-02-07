def test_notification_flow(client, admin_token_headers, db):
    from app.models import User, Notification

    # 1. Access the user created by the admin_token_headers fixture
    email = "testadmin@sanctum.com"
    user = db.query(User).filter(User.email == email).first()

    # Create the notification for the verified user
    notif = Notification(
        user_id=user.id,
        recipient_email=user.email, # Added as per your new schema requirement
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

    # 3. Mark as Read (Updated Path to include /read)
    nid = data[0]["id"]
    res = client.put(f"/notifications/{nid}/read", headers=admin_token_headers)
    
    assert res.status_code == 200
    assert res.json()["status"] == "updated" # Matches the router return value

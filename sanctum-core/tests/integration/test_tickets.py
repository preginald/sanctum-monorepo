def test_create_ticket(client, admin_token_headers):
    # SETUP: Create Account
    acc = client.post("/accounts", headers=admin_token_headers, json={
        "name": "Acme Corp", "type": "business", "brand_affinity": "nt"
    }).json()
    
    # ACT
    response = client.post(
        "/tickets",
        headers=admin_token_headers,
        json={
            "account_id": acc["id"],
            "subject": "Server Down",
            "description": "It is on fire.",
            "priority": "critical",
            "ticket_type": "bug" 
        },
    )
    
    # ASSERT
    assert response.status_code == 200
    data = response.json()
    assert data["subject"] == "Server Down"
    assert data["status"] == "new"

def test_resolve_ticket(client, admin_token_headers):
    # SETUP: Create Account & Ticket
    acc = client.post("/accounts", headers=admin_token_headers, json={
        "name": "Ticket Corp", "type": "business", "brand_affinity": "nt"
    }).json()
    
    t_res = client.post("/tickets", headers=admin_token_headers, json={
        "account_id": acc["id"], "subject": "To Resolve", "priority": "normal"
    }).json()
    tid = t_res["id"]
    
    # ACT: Resolve
    response = client.put(
        f"/tickets/{tid}",
        headers=admin_token_headers,
        json={
            "status": "resolved",
            "resolution": "Used fire extinguisher."
        }
    )
    
    # ASSERT
    assert response.status_code == 200
    assert response.json()["status"] == "resolved"
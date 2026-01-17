def test_create_account(client, admin_token_headers):
    response = client.post(
        "/accounts",
        headers=admin_token_headers,
        json={
            "name": "Cyberdyne Systems",
            "type": "business",
            "brand_affinity": "ds",
            "billing_email": "miles@cyberdyne.com"
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Cyberdyne Systems"
    assert "id" in data

def test_read_accounts(client, admin_token_headers):
    # SETUP: Create data within this test context
    client.post("/accounts", headers=admin_token_headers, json={
        "name": "Existing Corp", "type": "business", "brand_affinity": "ds"
    })

    # ACT
    response = client.get("/accounts", headers=admin_token_headers)
    
    # ASSERT
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert data[0]["name"] == "Existing Corp"
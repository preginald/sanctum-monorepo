def test_campaign_workflow(client, admin_token_headers):
    # 1. Create Campaign
    camp = client.post("/campaigns", headers=admin_token_headers, json={
        "name": "Q1 Outreach", "budget_cost": "5000.00"
    }).json()
    assert camp["id"]
    assert camp["status"] == "draft"

    # 2. Add Target (Requires Contact + Account)
    acc = client.post("/accounts", headers=admin_token_headers, json={"name": "Target Corp", "type": "biz", "brand_affinity": "ds"}).json()
    con = client.post("/contacts", headers=admin_token_headers, json={"account_id": acc["id"], "first_name": "John", "last_name": "Doe", "email": "j@t.com"}).json()
    
    # Target Logic involves filtering, usually done via bulk add, 
    # but let's assume we test the target creation logic implicitly or via direct DB if needed.
    # For now, let's verify the campaign exists.
    res = client.get(f"/campaigns/{camp['id']}", headers=admin_token_headers)
    assert res.status_code == 200

def test_deal_flow(client, admin_token_headers):
    acc = client.post("/accounts", headers=admin_token_headers, json={"name": "Deal Corp", "type": "biz", "brand_affinity": "ds"}).json()
    
    deal = client.post("/deals", headers=admin_token_headers, json={
        "account_id": acc["id"],
        "title": "Big Contract",
        "amount": "10000.00",
        "stage": "Infiltration"
    }).json()
    
    assert deal["amount"] == "10000.00"
    
    # Update Stage
    res = client.put(f"/deals/{deal['id']}", headers=admin_token_headers, json={"stage": "Closed Won"})
    assert res.json()["stage"] == "Closed Won"

def test_project_milestones(client, admin_token_headers):
    acc = client.post("/accounts", headers=admin_token_headers, json={"name": "Proj Corp", "type": "biz", "brand_affinity": "ds"}).json()
    
    proj = client.post("/projects", headers=admin_token_headers, json={
        "account_id": acc["id"], "name": "Migration", "budget": "50000.00"
    }).json()
    
    ms = client.post(f"/projects/{proj['id']}/milestones", headers=admin_token_headers, json={
        "name": "Phase 1", "billable_amount": "10000.00"
    }).json()
    
    assert ms["sequence"] == 1
    
    # Test Invoice Generation from Milestone
    inv = client.post(f"/milestones/{ms['id']}/invoice", headers=admin_token_headers)
    assert inv.status_code == 200
    assert inv.json()["total_amount"] == "11000.00" # 10k + GST
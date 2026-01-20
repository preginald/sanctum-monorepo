def test_asset_lifecycle(client, admin_token_headers):
    # 1. Create Account
    acc = client.post("/accounts", headers=admin_token_headers, json={"name": "Asset Corp", "type": "biz", "brand_affinity": "ds"}).json()
    
    # 2. Create Asset
    asset = client.post("/assets", headers=admin_token_headers, json={
        "account_id": acc["id"],
        "name": "Server-01",
        "asset_type": "Server",
        "ip_address": "192.168.1.50"
    }).json()
    
    assert asset["name"] == "Server-01"
    assert asset["id"] is not None
    
    # 3. List Assets
    assets = client.get(f"/assets?account_id={acc['id']}", headers=admin_token_headers).json()
    assert len(assets) == 1
    assert assets[0]["name"] == "Server-01"
    
    # 4. Update Asset
    updated = client.put(f"/assets/{asset['id']}", headers=admin_token_headers, json={"status": "retired"}).json()
    assert updated["status"] == "retired"
    
    # 5. Delete Asset
    res = client.delete(f"/assets/{asset['id']}", headers=admin_token_headers)
    assert res.status_code == 200
    
    # Verify Empty
    empty = client.get(f"/assets?account_id={acc['id']}", headers=admin_token_headers).json()
    assert len(empty) == 0
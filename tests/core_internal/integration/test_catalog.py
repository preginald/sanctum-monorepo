def test_product_crud(client, admin_token_headers):
    # Create
    prod = client.post("/products", headers=admin_token_headers, json={
        "name": "Consulting Hour",
        "type": "service",
        "unit_price": "250.00"
    }).json()
    
    assert prod["unit_price"] == "250.00"
    
    # List
    prods = client.get("/products", headers=admin_token_headers).json()
    assert len(prods) > 0
    
    # Archive
    res = client.delete(f"/products/{prod['id']}", headers=admin_token_headers)
    assert res.status_code == 200
    
    # Verify Archive
    prods_after = client.get("/products", headers=admin_token_headers).json()
    # Assuming get_products filters out inactive
    assert len(prods_after) == 0
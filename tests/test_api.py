import pytest

@pytest.mark.parametrize("method, endpoint, expected_status", [
    ("GET", "/", 200),                          # Root Health
    ("GET", "/system/health", 200),             # System Router
    ("GET", "/sentinel/templates", 200),        # Sentinel Router (No /api!)
    ("GET", "/notifications", 200),             # Notifications Router (No /api!)
])
def test_endpoints_status(api, method, endpoint, expected_status):
    """Replicates generic api_test.sh verification against real routes."""
    response = api.session.request(method, f"{api.base_url}{endpoint}")
    assert response.status_code == expected_status

def test_prefix_mismatch_fails(api):
    """
    PROVES that the current frontend baseURL (/api) will fail.
    If this returns 404, it confirms the frontend is currently broken.
    """
    # This simulates what axios.get('/sentinel/templates') does with the /api prefix
    response = api.session.get(f"{api.base_url}/api/sentinel/templates")

    print(f"\n[DEBUG] Testing /api prefix: {response.status_code}")
    assert response.status_code == 404, "Wait, /api actually worked? Check main.py prefixes!"

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

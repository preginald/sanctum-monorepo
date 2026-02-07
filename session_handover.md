## 0. SESSION HANDOVER (CURRENT STATE)
**Status:** GREEN / STABLE
**Milestone:** Unified Pytest Suite Implementation
**Date:** 2026-02-07

### ARCHITECTURAL UPDATES
- **Test Consolidation:** Internal tests from `sanctum-core/tests` moved to `tests/core_internal`.
- **Global Config:** `pytest.ini` created at root to manage `pythonpath` and suppress Pydantic v2 warnings.
- **Static Fix:** `app/static` placeholder created to prevent FastAPI mount failures during root-level execution.

### AUTHENTICATION STACK
- `tests/client.py`: Pythonic replacement for `api_test.sh`. Handles OAuth2 + TOTP.
- `conftest.py`: Implements interactive secret gathering with an `export` reminder to keep creds out of `.env`.

### KNOWN ROUTES (STRICT)
- All routers are mounted at root (no `/api` prefix).
- Notifications require action-based suffixes (e.g., `PUT /notifications/{id}/read`).

### NEXT ACTIONS
1. **Audit Legacy Tests:** Review `tests/core_internal` for any redundant logic.
2. **Expand Sentinel Tests:** Draft deep-dive tests for the "Essential 8" audit logic.
3. **CI/CD Prep:** Use the new Python suite to replace old Bash-based CI steps.

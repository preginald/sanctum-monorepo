"""CORS origin policy for Sanctum Core (#2957).

Defined in its own module so the regex constant can be imported by tests
without pulling in ``app.main``'s full router graph (and its optional runtime
dependencies like ``pyotp``).

The regex admits:
  * any ``*.digitalsanctum.com.au`` subdomain over https, plus the apex
  * ``localhost`` / ``127.0.0.1`` on dev ports ``5173`` and ``5174`` over http

Credentialed requests (Bearer JWT) require an exact origin echo, so we
deliberately avoid ``allow_origins=["*"]``. The regex is anchored and
restricts the subdomain charset to ``[a-z0-9-]+`` to block lookalike origins
such as ``evil.digitalsanctum.com.au.attacker.com``.
"""

CORS_ORIGIN_REGEX = (
    r"^https://([a-z0-9-]+\.)?digitalsanctum\.com\.au$"
    r"|^http://(localhost|127\.0\.0\.1):(5173|5174)$"
)

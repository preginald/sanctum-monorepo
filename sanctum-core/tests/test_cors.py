"""CORS preflight regression tests (#2957).

The FastAPI ``CORSMiddleware`` regex must admit every Sanctum subdomain over
https and the documented localhost dev ports, while rejecting unknown origins
and lookalike-suffix attacks.

Tests build a minimal FastAPI app that mounts only ``CORSMiddleware`` with the
regex exported from ``app.cors`` — this exercises the regex end-to-end through
Starlette's middleware without dragging in the full router tree (which has
optional runtime-only deps like ``pyotp``).
"""

from __future__ import annotations

import re

import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient


# Import only the regex constant from its own module — keeps this test
# independent of `app.main`'s router-level imports.
from app.cors import CORS_ORIGIN_REGEX


def _build_client() -> TestClient:
    """Minimal FastAPI app with the production CORS regex and one GET route."""
    app = FastAPI()

    @app.get("/ping")
    def _ping() -> dict:
        return {"ok": True}

    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=CORS_ORIGIN_REGEX,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    return TestClient(app)


client = _build_client()


def _preflight(origin: str):
    return client.options(
        "/ping",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )


ALLOWED_ORIGINS = [
    "https://core.digitalsanctum.com.au",
    "https://mock.digitalsanctum.com.au",
    "https://monitor.digitalsanctum.com.au",
    "https://vault.digitalsanctum.com.au",
    "https://hive.digitalsanctum.com.au",
    "https://flow.digitalsanctum.com.au",
    "https://compose.digitalsanctum.com.au",
    "https://notify.digitalsanctum.com.au",
    "https://digitalsanctum.com.au",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
]

REJECTED_ORIGINS = [
    "https://example.com",
    "https://evil.digitalsanctum.com.au.attacker.com",
    "http://mock.digitalsanctum.com.au",  # http, not https
    "https://DigitalSanctum.com.au",  # uppercase — regex is lowercase-only
    "http://localhost:3000",  # undocumented dev port
]


@pytest.mark.parametrize("origin", ALLOWED_ORIGINS)
def test_preflight_allowed_origin_is_echoed(origin: str) -> None:
    r = _preflight(origin)
    assert r.status_code == 200, (origin, r.text)
    assert r.headers.get("access-control-allow-origin") == origin
    assert r.headers.get("access-control-allow-credentials") == "true"


@pytest.mark.parametrize("origin", REJECTED_ORIGINS)
def test_preflight_rejected_origin_has_no_allow_header(origin: str) -> None:
    r = _preflight(origin)
    # Starlette's CORSMiddleware returns 400 when the preflight origin is
    # disallowed; the allow-origin header must not be echoed.
    assert r.status_code == 400, (origin, r.text)
    assert "access-control-allow-origin" not in {k.lower() for k in r.headers}


def test_regex_is_anchored_and_valid() -> None:
    """Defence-in-depth: regex must start with ``^`` and end with ``$``."""
    assert CORS_ORIGIN_REGEX.startswith("^")
    assert CORS_ORIGIN_REGEX.endswith("$")
    # Top-level alternation must sit between an end- and a start-anchor, i.e.
    # ``...$|^...``. Inner alternations (e.g. ``5173|5174``) are fine.
    assert "$|^" in CORS_ORIGIN_REGEX
    # Sanity: regex is valid Python re syntax.
    re.compile(CORS_ORIGIN_REGEX)

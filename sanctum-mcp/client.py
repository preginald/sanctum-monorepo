"""HTTP client for Sanctum Core API — used by all MCP tools."""

import os
import httpx
from dotenv import load_dotenv

load_dotenv()

API_BASE = os.getenv("SANCTUM_API_BASE", "https://core.digitalsanctum.com.au/api")
API_TOKEN = os.getenv("SANCTUM_API_TOKEN", "")


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json",
    }


async def get(path: str, params: dict | None = None) -> dict | list:
    async with httpx.AsyncClient(base_url=API_BASE, headers=_headers(), timeout=30) as c:
        r = await c.get(path, params=params)
        r.raise_for_status()
        return r.json()


async def post(path: str, json: dict | None = None) -> dict:
    async with httpx.AsyncClient(base_url=API_BASE, headers=_headers(), timeout=30) as c:
        r = await c.post(path, json=json)
        if r.status_code == 422:
            return {"error": True, "status_code": 422, **r.json()}
        r.raise_for_status()
        return r.json()


async def put(path: str, json: dict | None = None) -> dict:
    async with httpx.AsyncClient(base_url=API_BASE, headers=_headers(), timeout=30) as c:
        r = await c.put(path, json=json)
        if r.status_code == 422:
            return {"error": True, "status_code": 422, **r.json()}
        r.raise_for_status()
        return r.json()


async def patch(path: str, json: dict | None = None) -> dict:
    async with httpx.AsyncClient(base_url=API_BASE, headers=_headers(), timeout=30) as c:
        r = await c.patch(path, json=json)
        r.raise_for_status()
        return r.json()


async def delete(path: str) -> dict:
    async with httpx.AsyncClient(base_url=API_BASE, headers=_headers(), timeout=30) as c:
        r = await c.delete(path)
        r.raise_for_status()
        return r.json()

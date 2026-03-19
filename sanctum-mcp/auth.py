"""OAuth 2.0 Client Credentials auth for Sanctum MCP server."""

import os
import time
import json
import hashlib
import hmac
from urllib.parse import parse_qs

import jwt

# Config from environment
MCP_CLIENT_ID = os.getenv("MCP_CLIENT_ID", "")
MCP_CLIENT_SECRET = os.getenv("MCP_CLIENT_SECRET", "")
MCP_JWT_SECRET = os.getenv("MCP_JWT_SECRET", os.getenv("MCP_CLIENT_SECRET", ""))
MCP_TOKEN_EXPIRY = int(os.getenv("MCP_TOKEN_EXPIRY", "3600"))  # 1 hour default
MCP_AUTH_ENABLED = os.getenv("MCP_AUTH_ENABLED", "true").lower() == "true"


def _create_token() -> dict:
    """Create a JWT access token."""
    now = int(time.time())
    payload = {
        "sub": MCP_CLIENT_ID,
        "iat": now,
        "exp": now + MCP_TOKEN_EXPIRY,
        "scope": "mcp",
    }
    token = jwt.encode(payload, MCP_JWT_SECRET, algorithm="HS256")
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": MCP_TOKEN_EXPIRY,
    }


def _validate_token(token: str) -> bool:
    """Validate a JWT access token."""
    try:
        jwt.decode(token, MCP_JWT_SECRET, algorithms=["HS256"])
        return True
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return False


def _json_response(status: int, body: dict) -> tuple:
    """Return (status, headers, body) for an ASGI response."""
    data = json.dumps(body).encode()
    headers = [
        (b"content-type", b"application/json"),
        (b"content-length", str(len(data)).encode()),
    ]
    return status, headers, data


class OAuthMiddleware:
    """ASGI middleware that adds OAuth 2.0 Client Credentials flow.

    - POST /token — exchange client_id + client_secret for a bearer token
    - All other routes require Authorization: Bearer <token>
    - Auth can be disabled via MCP_AUTH_ENABLED=false for local dev
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        path = scope.get("path", "")
        method = scope.get("method", "GET")

        # --- /token endpoint ---
        if path == "/token" and method == "POST":
            return await self._handle_token(scope, receive, send)

        # --- Skip auth if disabled ---
        if not MCP_AUTH_ENABLED:
            return await self.app(scope, receive, send)

        # --- Skip auth if no credentials configured ---
        if not MCP_CLIENT_ID or not MCP_CLIENT_SECRET:
            return await self.app(scope, receive, send)

        # --- Validate bearer token ---
        headers = dict(scope.get("headers", []))
        auth_header = headers.get(b"authorization", b"").decode()

        if not auth_header.startswith("Bearer "):
            status, resp_headers, body = _json_response(
                401, {"error": "unauthorized", "error_description": "Bearer token required"}
            )
            await self._send_response(send, status, resp_headers, body)
            return

        token = auth_header[7:]  # Strip "Bearer "
        if not _validate_token(token):
            status, resp_headers, body = _json_response(
                401, {"error": "invalid_token", "error_description": "Token is invalid or expired"}
            )
            await self._send_response(send, status, resp_headers, body)
            return

        # Token valid — pass through
        return await self.app(scope, receive, send)

    async def _handle_token(self, scope, receive, send):
        """Handle POST /token — OAuth 2.0 Client Credentials grant."""
        # Read request body
        body = b""
        while True:
            message = await receive()
            body += message.get("body", b"")
            if not message.get("more_body", False):
                break

        # Parse form-encoded or JSON body
        content_type = ""
        for header_name, header_value in scope.get("headers", []):
            if header_name == b"content-type":
                content_type = header_value.decode()
                break

        client_id = ""
        client_secret = ""

        if "application/x-www-form-urlencoded" in content_type:
            params = parse_qs(body.decode())
            client_id = params.get("client_id", [""])[0]
            client_secret = params.get("client_secret", [""])[0]
            # Also support grant_type validation
            grant_type = params.get("grant_type", [""])[0]
            if grant_type and grant_type != "client_credentials":
                status, resp_headers, resp_body = _json_response(
                    400, {"error": "unsupported_grant_type"}
                )
                await self._send_response(send, status, resp_headers, resp_body)
                return
        elif "application/json" in content_type:
            try:
                data = json.loads(body)
                client_id = data.get("client_id", "")
                client_secret = data.get("client_secret", "")
            except json.JSONDecodeError:
                status, resp_headers, resp_body = _json_response(
                    400, {"error": "invalid_request", "error_description": "Invalid JSON"}
                )
                await self._send_response(send, status, resp_headers, resp_body)
                return
        else:
            status, resp_headers, resp_body = _json_response(
                400, {"error": "invalid_request", "error_description": "Content-Type must be application/x-www-form-urlencoded or application/json"}
            )
            await self._send_response(send, status, resp_headers, resp_body)
            return

        # Validate credentials
        if not MCP_CLIENT_ID or not MCP_CLIENT_SECRET:
            status, resp_headers, resp_body = _json_response(
                500, {"error": "server_error", "error_description": "OAuth not configured"}
            )
            await self._send_response(send, status, resp_headers, resp_body)
            return

        if not hmac.compare_digest(client_id, MCP_CLIENT_ID) or \
           not hmac.compare_digest(client_secret, MCP_CLIENT_SECRET):
            status, resp_headers, resp_body = _json_response(
                401, {"error": "invalid_client", "error_description": "Invalid client credentials"}
            )
            await self._send_response(send, status, resp_headers, resp_body)
            return

        # Issue token
        token_response = _create_token()
        status, resp_headers, resp_body = _json_response(200, token_response)
        await self._send_response(send, status, resp_headers, resp_body)

    async def _send_response(self, send, status, headers, body):
        await send({
            "type": "http.response.start",
            "status": status,
            "headers": headers,
        })
        await send({
            "type": "http.response.body",
            "body": body,
        })

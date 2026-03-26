"""OAuth 2.0 auth for Sanctum MCP server.

Supports:
- Authorization Code flow with PKCE (for Claude AI Custom Connector)
- Client Credentials flow (for Claude Code / machine-to-machine)
- RFC 8414 OAuth Server Metadata discovery
- RFC 7591 Dynamic Client Registration
"""

import os
import time
import json
import hmac
import secrets
import hashlib
import base64
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse

import jwt

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────

MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "https://mcp.digitalsanctum.com.au")
MCP_CLIENT_ID = os.getenv("MCP_CLIENT_ID", "")
MCP_CLIENT_SECRET = os.getenv("MCP_CLIENT_SECRET", "")
MCP_JWT_SECRET = os.getenv("MCP_JWT_SECRET", os.getenv("MCP_CLIENT_SECRET", ""))
MCP_TOKEN_EXPIRY = int(os.getenv("MCP_TOKEN_EXPIRY", "3600"))
MCP_REFRESH_EXPIRY = int(os.getenv("MCP_REFRESH_EXPIRY", "2592000"))  # 30 days
MCP_AUTH_ENABLED = os.getenv("MCP_AUTH_ENABLED", "true").lower() == "true"
MCP_AUTH_USERNAME = os.getenv("MCP_AUTH_USERNAME", "admin")
MCP_AUTH_PASSWORD = os.getenv("MCP_AUTH_PASSWORD", "")

# Auth codes are ephemeral (5 min TTL) — in-memory is fine
_auth_codes = {}  # code -> {client_id, redirect_uri, code_challenge, expires_at}

# Registered clients persisted to disk so they survive server restarts
_CLIENTS_FILE = Path(__file__).parent / "registered_clients.json"
_REFRESH_FILE = Path(__file__).parent / "refresh_tokens.json"


def _load_registered_clients() -> dict:
    if _CLIENTS_FILE.exists():
        try:
            return json.loads(_CLIENTS_FILE.read_text())
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def _save_registered_clients() -> None:
    _CLIENTS_FILE.write_text(json.dumps(_registered_clients, indent=2))


_registered_clients = _load_registered_clients()


def _load_refresh_tokens() -> dict:
    if _REFRESH_FILE.exists():
        try:
            return json.loads(_REFRESH_FILE.read_text())
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def _save_refresh_tokens() -> None:
    _REFRESH_FILE.write_text(json.dumps(_refresh_tokens, indent=2))


_refresh_tokens = _load_refresh_tokens()  # token -> {sub, client_id, issued_at, expires_at}

ALLOWED_CALLBACKS = [
    "https://claude.ai/api/mcp/auth_callback",
    "https://claude.com/api/mcp/auth_callback",
]


# ─────────────────────────────────────────────
# TOKEN HELPERS
# ─────────────────────────────────────────────

def _create_token(sub: str = "", client_id: str = "") -> dict:
    now = int(time.time())
    payload = {
        "sub": sub or MCP_CLIENT_ID,
        "iat": now,
        "exp": now + MCP_TOKEN_EXPIRY,
        "scope": "mcp",
    }
    access_token = jwt.encode(payload, MCP_JWT_SECRET, algorithm="HS256")
    refresh_token = secrets.token_urlsafe(48)
    _refresh_tokens[refresh_token] = {
        "sub": sub or MCP_CLIENT_ID,
        "client_id": client_id or sub or MCP_CLIENT_ID,
        "issued_at": now,
        "expires_at": now + MCP_REFRESH_EXPIRY,
    }
    _save_refresh_tokens()
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": MCP_TOKEN_EXPIRY,
        "refresh_token": refresh_token,
    }


def _validate_token(token: str) -> bool:
    try:
        jwt.decode(token, MCP_JWT_SECRET, algorithms=["HS256"])
        return True
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return False


def _json_response(status: int, body: dict) -> tuple:
    data = json.dumps(body).encode()
    headers = [
        (b"content-type", b"application/json"),
        (b"content-length", str(len(data)).encode()),
    ]
    return status, headers, data


def _html_response(status: int, html: str) -> tuple:
    data = html.encode()
    headers = [
        (b"content-type", b"text/html; charset=utf-8"),
        (b"content-length", str(len(data)).encode()),
    ]
    return status, headers, data


def _redirect_response(location: str) -> tuple:
    headers = [
        (b"location", location.encode()),
        (b"content-length", b"0"),
    ]
    return 302, headers, b""


def _verify_pkce(code_verifier: str, code_challenge: str, method: str = "S256") -> bool:
    if method == "S256":
        digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
        computed = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
        return hmac.compare_digest(computed, code_challenge)
    elif method == "plain":
        return hmac.compare_digest(code_verifier, code_challenge)
    return False


# ─────────────────────────────────────────────
# LOGIN PAGE
# ─────────────────────────────────────────────

def _login_page(client_id: str, redirect_uri: str, state: str,
                code_challenge: str, code_challenge_method: str,
                error: str = "") -> str:
    error_html = f'<p style="color:#ff6b6b;margin-bottom:16px">{error}</p>' if error else ""
    return f"""<!DOCTYPE html>
<html>
<head>
    <title>Sanctum MCP — Authorize</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {{ background: #0f172a; color: #e2e8f0; font-family: system-ui, sans-serif;
               display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }}
        .card {{ background: #1e293b; border: 1px solid #334155; border-radius: 12px;
                padding: 32px; width: 100%; max-width: 380px; }}
        h1 {{ font-size: 18px; margin: 0 0 8px 0; color: #d4a843; }}
        p.sub {{ font-size: 13px; opacity: 0.6; margin: 0 0 24px 0; }}
        label {{ display: block; font-size: 12px; font-weight: bold; text-transform: uppercase;
                letter-spacing: 0.05em; opacity: 0.7; margin-bottom: 6px; }}
        input {{ width: 100%; padding: 10px 12px; background: #0f172a; border: 1px solid #475569;
                border-radius: 8px; color: #e2e8f0; font-size: 14px; box-sizing: border-box; margin-bottom: 16px; }}
        input:focus {{ outline: none; border-color: #d4a843; }}
        button {{ width: 100%; padding: 12px; background: #d4a843; color: #0f172a; border: none;
                 border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; }}
        button:hover {{ background: #e5b954; }}
        .client {{ font-size: 11px; opacity: 0.4; margin-top: 16px; text-align: center; }}
    </style>
</head>
<body>
    <div class="card">
        <h1>Sanctum MCP</h1>
        <p class="sub">Authorize access to your Sanctum tools</p>
        {error_html}
        <form method="POST" action="/authorize">
            <input type="hidden" name="client_id" value="{client_id}">
            <input type="hidden" name="redirect_uri" value="{redirect_uri}">
            <input type="hidden" name="state" value="{state}">
            <input type="hidden" name="code_challenge" value="{code_challenge}">
            <input type="hidden" name="code_challenge_method" value="{code_challenge_method}">
            <label>Username</label>
            <input type="text" name="username" autocomplete="username" required>
            <label>Password</label>
            <input type="password" name="password" autocomplete="current-password" required>
            <button type="submit">Authorize</button>
        </form>
        <p class="client">Client: {client_id}</p>
    </div>
</body>
</html>"""


# ─────────────────────────────────────────────
# MIDDLEWARE
# ─────────────────────────────────────────────

class OAuthMiddleware:
    """ASGI middleware implementing OAuth 2.0 Authorization Code + Client Credentials.

    Routes handled:
    - GET  /.well-known/oauth-authorization-server — RFC 8414 metadata
    - GET  /authorize — login page
    - POST /authorize — validate credentials, issue auth code, redirect
    - POST /token — exchange auth code or client credentials for bearer token
    - POST /register — Dynamic Client Registration (RFC 7591)
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        path = scope.get("path", "")
        method = scope.get("method", "GET")

        # --- Health endpoint (always accessible, no auth) ---
        if path == "/health" and method == "GET":
            return await self._handle_health(scope, receive, send)

        # --- OAuth endpoints (always accessible) ---
        if path == "/.well-known/oauth-authorization-server" and method == "GET":
            return await self._handle_metadata(scope, receive, send)
        if path == "/authorize" and method == "GET":
            return await self._handle_authorize_get(scope, receive, send)
        if path == "/authorize" and method == "POST":
            return await self._handle_authorize_post(scope, receive, send)
        if path == "/token" and method == "POST":
            return await self._handle_token(scope, receive, send)
        if path == "/register" and method == "POST":
            return await self._handle_register(scope, receive, send)

        # --- Skip auth if disabled ---
        if not MCP_AUTH_ENABLED:
            return await self.app(scope, receive, send)

        # --- Skip auth if no credentials configured ---
        if not MCP_JWT_SECRET:
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

        token = auth_header[7:]
        if not _validate_token(token):
            status, resp_headers, body = _json_response(
                401, {"error": "invalid_token", "error_description": "Token is invalid or expired"}
            )
            await self._send_response(send, status, resp_headers, body)
            return

        return await self.app(scope, receive, send)

    # ─── Health Check ─────────────────────────

    async def _handle_health(self, scope, receive, send):
        import health
        from client import _client, _MAX_CONN, _MAX_KEEPALIVE

        # Pool metrics
        active = 0
        try:
            if _client and not _client.is_closed:
                pool = _client._transport._pool
                active = sum(1 for c in pool.connections if not c.is_idle())
        except (AttributeError, TypeError):
            pass

        # SSE session count — lazy discovery of session manager
        sse_sessions = -1
        if not health._session_manager and not health._session_manager_searched:
            health._session_manager_searched = True
            health._session_manager = self._find_session_manager(self.app)
        if health._session_manager is not None:
            try:
                sse_sessions = len(health._session_manager._server_instances)
            except (AttributeError, TypeError):
                sse_sessions = -1

        payload = {
            "status": "ok",
            "pool": {
                "max_connections": _MAX_CONN,
                "max_keepalive": _MAX_KEEPALIVE,
                "active_connections": active,
            },
            "sse_sessions": sse_sessions,
            "uptime_seconds": int(time.time() - health._start_time),
        }
        status, headers, body = _json_response(200, payload)
        await self._send_response(send, status, headers, body)

    @staticmethod
    def _find_session_manager(app):
        """Walk Starlette routes to find the StreamableHTTPSessionManager."""
        routes = getattr(app, "routes", [])
        for route in routes:
            endpoint = getattr(route, "app", None) or getattr(route, "endpoint", None)
            sm = getattr(endpoint, "session_manager", None)
            if sm is not None:
                return sm
            # Wrapped in auth middleware — check .app attribute
            inner = getattr(endpoint, "app", None)
            if inner:
                sm = getattr(inner, "session_manager", None)
                if sm is not None:
                    return sm
        return None

    # ─── RFC 8414 Metadata ────────────────────

    async def _handle_metadata(self, scope, receive, send):
        metadata = {
            "issuer": MCP_SERVER_URL,
            "authorization_endpoint": f"{MCP_SERVER_URL}/authorize",
            "token_endpoint": f"{MCP_SERVER_URL}/token",
            "registration_endpoint": f"{MCP_SERVER_URL}/register",
            "response_types_supported": ["code"],
            "grant_types_supported": ["authorization_code", "client_credentials", "refresh_token"],
            "token_endpoint_auth_methods_supported": ["client_secret_post"],
            "code_challenge_methods_supported": ["S256", "plain"],
        }
        status, headers, body = _json_response(200, metadata)
        await self._send_response(send, status, headers, body)

    # ─── GET /authorize ───────────────────────

    async def _handle_authorize_get(self, scope, receive, send):
        qs = dict(parse_qs(scope.get("query_string", b"").decode()))
        client_id = qs.get("client_id", [""])[0]
        redirect_uri = qs.get("redirect_uri", [""])[0]
        state = qs.get("state", [""])[0]
        code_challenge = qs.get("code_challenge", [""])[0]
        code_challenge_method = qs.get("code_challenge_method", ["S256"])[0]

        if not client_id or not redirect_uri:
            status, headers, body = _json_response(
                400, {"error": "invalid_request", "error_description": "client_id and redirect_uri required"}
            )
            await self._send_response(send, status, headers, body)
            return

        if not self._is_redirect_allowed(client_id, redirect_uri):
            status, headers, body = _json_response(
                400, {"error": "invalid_request", "error_description": "redirect_uri not allowed"}
            )
            await self._send_response(send, status, headers, body)
            return

        html = _login_page(client_id, redirect_uri, state, code_challenge, code_challenge_method)
        status, headers, body = _html_response(200, html)
        await self._send_response(send, status, headers, body)

    # ─── POST /authorize ──────────────────────

    async def _handle_authorize_post(self, scope, receive, send):
        body = await self._read_body(receive)
        params = parse_qs(body.decode())

        username = params.get("username", [""])[0]
        password = params.get("password", [""])[0]
        client_id = params.get("client_id", [""])[0]
        redirect_uri = params.get("redirect_uri", [""])[0]
        state = params.get("state", [""])[0]
        code_challenge = params.get("code_challenge", [""])[0]
        code_challenge_method = params.get("code_challenge_method", ["S256"])[0]

        # Validate redirect_uri against allow list
        if not self._is_redirect_allowed(client_id, redirect_uri):
            status, headers, body = _json_response(
                400, {"error": "invalid_request", "error_description": "redirect_uri not allowed"}
            )
            await self._send_response(send, status, headers, body)
            return

        # Validate credentials
        if not MCP_AUTH_PASSWORD:
            html = _login_page(client_id, redirect_uri, state, code_challenge, code_challenge_method,
                               error="Server auth not configured (MCP_AUTH_PASSWORD not set)")
            status, headers, body = _html_response(500, html)
            await self._send_response(send, status, headers, body)
            return

        if not hmac.compare_digest(username, MCP_AUTH_USERNAME) or \
           not hmac.compare_digest(password, MCP_AUTH_PASSWORD):
            html = _login_page(client_id, redirect_uri, state, code_challenge, code_challenge_method,
                               error="Invalid username or password")
            status, headers, body = _html_response(200, html)
            await self._send_response(send, status, headers, body)
            return

        # Generate authorization code
        code = secrets.token_urlsafe(32)
        _auth_codes[code] = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "code_challenge": code_challenge,
            "code_challenge_method": code_challenge_method,
            "expires_at": time.time() + 300,  # 5 min
        }

        # Redirect back to client
        redirect_params = {"code": code}
        if state:
            redirect_params["state"] = state
        location = f"{redirect_uri}?{urlencode(redirect_params)}"
        status, headers, body = _redirect_response(location)
        await self._send_response(send, status, headers, body)

    # ─── POST /token ──────────────────────────

    async def _handle_token(self, scope, receive, send):
        body = await self._read_body(receive)
        content_type = self._get_header(scope, b"content-type")

        if "application/x-www-form-urlencoded" in content_type:
            params = parse_qs(body.decode())
            grant_type = params.get("grant_type", [""])[0]
            client_id = params.get("client_id", [""])[0]
            client_secret = params.get("client_secret", [""])[0]
            code = params.get("code", [""])[0]
            code_verifier = params.get("code_verifier", [""])[0]
            redirect_uri = params.get("redirect_uri", [""])[0]
            refresh_token = params.get("refresh_token", [""])[0]
        elif "application/json" in content_type:
            try:
                data = json.loads(body)
            except json.JSONDecodeError:
                status, headers, resp_body = _json_response(400, {"error": "invalid_request"})
                await self._send_response(send, status, headers, resp_body)
                return
            grant_type = data.get("grant_type", "")
            client_id = data.get("client_id", "")
            client_secret = data.get("client_secret", "")
            code = data.get("code", "")
            code_verifier = data.get("code_verifier", "")
            redirect_uri = data.get("redirect_uri", "")
            refresh_token = data.get("refresh_token", "")
        else:
            status, headers, resp_body = _json_response(400, {"error": "invalid_request"})
            await self._send_response(send, status, headers, resp_body)
            return

        if grant_type == "authorization_code":
            await self._token_authorization_code(send, client_id, client_secret, code, code_verifier, redirect_uri)
        elif grant_type == "client_credentials":
            await self._token_client_credentials(send, client_id, client_secret)
        elif grant_type == "refresh_token":
            await self._token_refresh(send, client_id, refresh_token)
        else:
            status, headers, resp_body = _json_response(400, {"error": "unsupported_grant_type"})
            await self._send_response(send, status, headers, resp_body)

    async def _token_authorization_code(self, send, client_id, client_secret, code, code_verifier, redirect_uri):
        # Look up auth code
        code_data = _auth_codes.pop(code, None)
        if not code_data:
            status, headers, body = _json_response(400, {"error": "invalid_grant", "error_description": "Invalid or expired authorization code"})
            await self._send_response(send, status, headers, body)
            return

        # Check expiry
        if time.time() > code_data["expires_at"]:
            status, headers, body = _json_response(400, {"error": "invalid_grant", "error_description": "Authorization code expired"})
            await self._send_response(send, status, headers, body)
            return

        # Verify client_id matches
        if client_id and client_id != code_data["client_id"]:
            status, headers, body = _json_response(400, {"error": "invalid_grant", "error_description": "client_id mismatch"})
            await self._send_response(send, status, headers, body)
            return

        # Verify PKCE if code_challenge was provided
        if code_data.get("code_challenge"):
            if not code_verifier:
                status, headers, body = _json_response(400, {"error": "invalid_grant", "error_description": "code_verifier required"})
                await self._send_response(send, status, headers, body)
                return
            method = code_data.get("code_challenge_method", "S256")
            if not _verify_pkce(code_verifier, code_data["code_challenge"], method):
                status, headers, body = _json_response(400, {"error": "invalid_grant", "error_description": "PKCE verification failed"})
                await self._send_response(send, status, headers, body)
                return

        # Issue token
        effective_client_id = client_id or code_data["client_id"]
        token_response = _create_token(sub=effective_client_id, client_id=effective_client_id)
        status, headers, body = _json_response(200, token_response)
        await self._send_response(send, status, headers, body)

    async def _token_client_credentials(self, send, client_id, client_secret):
        # Check against env credentials
        valid = False
        if MCP_CLIENT_ID and MCP_CLIENT_SECRET:
            if hmac.compare_digest(client_id, MCP_CLIENT_ID) and \
               hmac.compare_digest(client_secret, MCP_CLIENT_SECRET):
                valid = True

        # Check against dynamically registered clients
        if not valid and client_id in _registered_clients:
            stored = _registered_clients[client_id]
            if hmac.compare_digest(client_secret, stored["client_secret"]):
                valid = True

        if not valid:
            status, headers, body = _json_response(401, {"error": "invalid_client"})
            await self._send_response(send, status, headers, body)
            return

        token_response = _create_token(sub=client_id, client_id=client_id)
        status, headers, body = _json_response(200, token_response)
        await self._send_response(send, status, headers, body)

    async def _token_refresh(self, send, client_id, refresh_token):
        # Lazy cleanup: evict expired refresh tokens to prevent memory leak
        now = time.time()
        expired = [k for k, v in _refresh_tokens.items() if v["expires_at"] < now]
        for k in expired:
            del _refresh_tokens[k]
        if expired:
            _save_refresh_tokens()

        # Validate refresh token
        token_data = _refresh_tokens.pop(refresh_token, None)
        if not token_data:
            status, headers, body = _json_response(
                400, {"error": "invalid_grant", "error_description": "Invalid or expired refresh token"}
            )
            await self._send_response(send, status, headers, body)
            return

        if token_data["expires_at"] < now:
            _save_refresh_tokens()
            status, headers, body = _json_response(
                400, {"error": "invalid_grant", "error_description": "Refresh token expired"}
            )
            await self._send_response(send, status, headers, body)
            return

        # Issue new access + refresh token pair (single-use rotation)
        effective_sub = token_data["sub"]
        effective_client = token_data.get("client_id", client_id or effective_sub)
        token_response = _create_token(sub=effective_sub, client_id=effective_client)
        status, headers, body = _json_response(200, token_response)
        await self._send_response(send, status, headers, body)

    # ─── POST /register (RFC 7591) ────────────

    async def _handle_register(self, scope, receive, send):
        body = await self._read_body(receive)
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            status, headers, resp_body = _json_response(400, {"error": "invalid_request"})
            await self._send_response(send, status, headers, resp_body)
            return

        client_name = data.get("client_name", "unknown")
        redirect_uris = data.get("redirect_uris", [])

        # Generate client credentials
        new_client_id = f"sanctum_mcp_{secrets.token_hex(8)}"
        new_client_secret = secrets.token_hex(32)

        _registered_clients[new_client_id] = {
            "client_secret": new_client_secret,
            "redirect_uris": redirect_uris,
            "client_name": client_name,
        }
        _save_registered_clients()

        response = {
            "client_id": new_client_id,
            "client_secret": new_client_secret,
            "client_name": client_name,
            "redirect_uris": redirect_uris,
            "grant_types": ["authorization_code", "client_credentials", "refresh_token"],
            "token_endpoint_auth_method": "client_secret_post",
        }
        status, headers, resp_body = _json_response(201, response)
        await self._send_response(send, status, headers, resp_body)

    # ─── Helpers ──────────────────────────────

    def _is_redirect_allowed(self, client_id: str, redirect_uri: str) -> bool:
        """Check redirect_uri against ALLOWED_CALLBACKS and registered client URIs."""
        parsed = urlparse(redirect_uri)
        base_uri = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        if base_uri in ALLOWED_CALLBACKS:
            return True
        # Also accept URIs registered by dynamic clients (e.g. Claude Code localhost)
        client_data = _registered_clients.get(client_id, {})
        if redirect_uri in client_data.get("redirect_uris", []):
            return True
        # Allow localhost callbacks for dev (dynamic registration uses ephemeral ports)
        if parsed.hostname in ("localhost", "127.0.0.1"):
            return True
        return False

    async def _read_body(self, receive) -> bytes:
        body = b""
        while True:
            message = await receive()
            body += message.get("body", b"")
            if not message.get("more_body", False):
                break
        return body

    def _get_header(self, scope, name: bytes) -> str:
        for header_name, header_value in scope.get("headers", []):
            if header_name == name:
                return header_value.decode()
        return ""

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

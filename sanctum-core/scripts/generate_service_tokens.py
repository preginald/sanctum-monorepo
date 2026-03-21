"""
Generate API tokens for service accounts (Claude Chat + Claude Code).

Run AFTER the migration has been applied:
    cd sanctum-core && source venv/bin/activate
    python scripts/generate_service_tokens.py

Prints raw tokens to stdout — save them immediately.
"""

import secrets
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.auth import pwd_context

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set")
    sys.exit(1)

engine = create_engine(DATABASE_URL)

SERVICE_ACCOUNTS = [
    {
        "user_id": "a1b2c3d4-0001-4000-8000-000000000001",
        "name": "Claude Chat",
        "token_name": "MCP Server Token",
    },
    {
        "user_id": "a1b2c3d4-0002-4000-8000-000000000002",
        "name": "Claude Code",
        "token_name": "Code Session Token",
    },
]

with engine.connect() as conn:
    for sa in SERVICE_ACCOUNTS:
        # Check if token already exists for this user
        existing = conn.execute(
            text("SELECT id FROM api_tokens WHERE user_id = :uid AND is_active = true"),
            {"uid": sa["user_id"]}
        ).fetchone()

        if existing:
            print(f"SKIP: {sa['name']} already has an active token (id: {existing[0]})")
            continue

        raw_token = f"sntm_{secrets.token_hex(20)}"
        prefix = raw_token[:12]
        token_hash = pwd_context.hash(raw_token)

        conn.execute(
            text("""
                INSERT INTO api_tokens (user_id, name, token_hash, token_prefix, scopes, is_active)
                VALUES (:user_id, :name, :token_hash, :token_prefix, :scopes, true)
            """),
            {
                "user_id": sa["user_id"],
                "name": sa["token_name"],
                "token_hash": token_hash,
                "token_prefix": prefix,
                "scopes": '["*"]',
            }
        )
        conn.commit()

        print(f"\n{'='*60}")
        print(f"  {sa['name']} — {sa['token_name']}")
        print(f"  Token: {raw_token}")
        print(f"  Prefix: {prefix}")
        print(f"  SAVE THIS TOKEN NOW — it cannot be retrieved again.")
        print(f"{'='*60}")

print("\nDone. Update MCP server and Code session configs with the tokens above.")

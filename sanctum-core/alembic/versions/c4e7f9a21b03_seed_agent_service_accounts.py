"""seed per-agent service accounts and rename existing

Revision ID: c4e7f9a21b03
Revises: b8f3a2d17e94
Create Date: 2026-03-21

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'c4e7f9a21b03'
down_revision = 'b8f3a2d17e94'
branch_labels = None
depends_on = None

# Digital Sanctum HQ account
ACCOUNT_ID = 'dbc2c7b9-d8c2-493f-a6ed-527f7d191068'

RENAMES = [
    ("a1b2c3d4-0001-4000-8000-000000000001", "The Oracle"),
    ("a1b2c3d4-0002-4000-8000-000000000002", "The Operator"),
]

NEW_ACCOUNTS = [
    ("a1b2c3d4-0003-4000-8000-000000000003", "the-architect@system.local", "The Architect"),
    ("a1b2c3d4-0004-4000-8000-000000000004", "the-surgeon@system.local", "The Surgeon"),
    ("a1b2c3d4-0005-4000-8000-000000000005", "the-sentinel@system.local", "The Sentinel"),
    ("a1b2c3d4-0006-4000-8000-000000000006", "the-scribe@system.local", "The Scribe"),
]


def upgrade() -> None:
    # Rename existing service accounts
    for user_id, new_name in RENAMES:
        op.execute(
            f"UPDATE users SET full_name = '{new_name}' "
            f"WHERE id = '{user_id}'"
        )

    # Seed new agent service accounts
    for user_id, email, full_name in NEW_ACCOUNTS:
        op.execute(f"""
            INSERT INTO users (id, email, password_hash, full_name, role, user_type, is_active, account_id)
            VALUES (
                '{user_id}',
                '{email}',
                '!',
                '{full_name}',
                'admin',
                'service_account',
                true,
                '{ACCOUNT_ID}'
            )
            ON CONFLICT (email) DO NOTHING;
        """)


def downgrade() -> None:
    # Revert renames
    op.execute(
        "UPDATE users SET full_name = 'Claude Chat' "
        "WHERE id = 'a1b2c3d4-0001-4000-8000-000000000001'"
    )
    op.execute(
        "UPDATE users SET full_name = 'Claude Code' "
        "WHERE id = 'a1b2c3d4-0002-4000-8000-000000000002'"
    )

    # Remove new accounts
    op.execute(
        "DELETE FROM users WHERE email IN ("
        "'the-architect@system.local', 'the-surgeon@system.local', "
        "'the-sentinel@system.local', 'the-scribe@system.local')"
    )

"""add user_type column and seed service accounts

Revision ID: b8f3a2d17e94
Revises: a742b001c001
Create Date: 2026-03-21

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b8f3a2d17e94'
down_revision = 'a742b001c001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Step 1: Add user_type column with default 'human'
    op.add_column('users', sa.Column(
        'user_type', sa.String(), nullable=False, server_default='human'
    ))

    # Step 2: Seed service account users
    # UUIDs are deterministic so they can be referenced in config/scripts
    # password_hash is NOT NULL in DB — use '!' (unmatchable bcrypt, login disabled)
    op.execute("""
        INSERT INTO users (id, email, password_hash, full_name, role, user_type, is_active, account_id)
        VALUES (
            'a1b2c3d4-0001-4000-8000-000000000001',
            'claude-chat@system.local',
            '!',
            'Claude Chat',
            'admin',
            'service_account',
            true,
            'dbc2c7b9-d8c2-493f-a6ed-527f7d191068'
        )
        ON CONFLICT (email) DO NOTHING;
    """)
    op.execute("""
        INSERT INTO users (id, email, password_hash, full_name, role, user_type, is_active, account_id)
        VALUES (
            'a1b2c3d4-0002-4000-8000-000000000002',
            'claude-code@system.local',
            '!',
            'Claude Code',
            'admin',
            'service_account',
            true,
            'dbc2c7b9-d8c2-493f-a6ed-527f7d191068'
        )
        ON CONFLICT (email) DO NOTHING;
    """)


def downgrade() -> None:
    op.execute("DELETE FROM users WHERE email IN ('claude-chat@system.local', 'claude-code@system.local')")
    op.drop_column('users', 'user_type')

"""seed The Chat service account

Revision ID: d7a8b9c10e11
Revises: c3d5e7f92155
Create Date: 2026-04-14

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'd7a8b9c10e11'
down_revision = 'c3d5e7f92155'
branch_labels = None
depends_on = None

# Digital Sanctum HQ account
ACCOUNT_ID = 'dbc2c7b9-d8c2-493f-a6ed-527f7d191068'


def upgrade() -> None:
    op.execute("""
        INSERT INTO users (id, email, password_hash, full_name, role, user_type, is_active, account_id)
        VALUES (
            'a1b2c3d4-0007-4000-8000-000000000007',
            'the-chat@system.local',
            '!',
            'The Chat',
            'admin',
            'service_account',
            true,
            'dbc2c7b9-d8c2-493f-a6ed-527f7d191068'
        )
        ON CONFLICT (email) DO NOTHING;
    """)


def downgrade() -> None:
    op.execute(
        "DELETE FROM users WHERE email = 'the-chat@system.local'"
    )

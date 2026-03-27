"""seed website assets from accounts

Revision ID: d7f2e9b34c12
Revises: c4e1f8a23b01
Create Date: 2026-03-28

Data migration: converts existing Account.website values into website assets.
Status is 'active' (not 'draft') because these are confirmed URLs already in use.
Idempotent via NOT EXISTS guard.

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'd7f2e9b34c12'
down_revision = 'c4e1f8a23b01'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        INSERT INTO assets (id, account_id, name, asset_type, status, specs, created_at)
        SELECT gen_random_uuid(), a.id, a.website, 'website', 'active', '{}'::jsonb, NOW()
        FROM accounts a
        WHERE a.website IS NOT NULL AND a.website != ''
        AND NOT EXISTS (
            SELECT 1 FROM assets x
            WHERE x.account_id = a.id AND x.asset_type = 'website' AND x.name = a.website
        )
    """)


def downgrade() -> None:
    # Only delete assets that were created by this migration (website type with matching account.website)
    op.execute("""
        DELETE FROM assets
        WHERE asset_type = 'website'
        AND account_id IN (SELECT id FROM accounts WHERE website IS NOT NULL AND website != '')
        AND name IN (SELECT website FROM accounts WHERE website IS NOT NULL AND website != '')
    """)

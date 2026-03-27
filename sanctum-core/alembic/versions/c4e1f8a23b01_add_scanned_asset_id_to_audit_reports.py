"""add scanned_asset_id to audit_reports

Revision ID: c4e1f8a23b01
Revises: a2900e459652
Create Date: 2026-03-28

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'c4e1f8a23b01'
down_revision = 'a2900e459652'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE audit_reports "
        "ADD COLUMN scanned_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL"
    )
    op.execute(
        "CREATE INDEX ix_audit_reports_scanned_asset_id "
        "ON audit_reports(scanned_asset_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_audit_reports_scanned_asset_id")
    op.execute("ALTER TABLE audit_reports DROP COLUMN IF EXISTS scanned_asset_id")

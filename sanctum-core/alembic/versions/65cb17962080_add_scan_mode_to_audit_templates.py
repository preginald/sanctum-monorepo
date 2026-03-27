"""add scan_mode to audit_templates

Revision ID: 65cb17962080
Revises: b3f7a2c8d901
Create Date: 2026-03-28

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '65cb17962080'
down_revision = 'b3f7a2c8d901'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE audit_templates ADD COLUMN scan_mode VARCHAR(20) NOT NULL DEFAULT 'manual'"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE audit_templates DROP COLUMN scan_mode")

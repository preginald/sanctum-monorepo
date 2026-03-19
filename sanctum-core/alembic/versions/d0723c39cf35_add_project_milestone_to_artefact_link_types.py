"""add project and milestone to artefact_link_entity_type enum

Revision ID: d0723c39cf35
Revises: 052736113dab
Create Date: 2026-03-20

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'd0723c39cf35'
down_revision = '052736113dab'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE artefact_link_entity_type ADD VALUE IF NOT EXISTS 'project'")
    op.execute("ALTER TYPE artefact_link_entity_type ADD VALUE IF NOT EXISTS 'milestone'")


def downgrade() -> None:
    # PostgreSQL does not support removing values from enums.
    # To downgrade, recreate the enum type without the new values.
    pass

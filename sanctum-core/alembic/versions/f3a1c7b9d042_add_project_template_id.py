"""add project template_id column

Revision ID: f3a1c7b9d042
Revises: e2451bd1d949
Create Date: 2026-04-03
"""
from alembic import op
import sqlalchemy as sa

revision = "f3a1c7b9d042"
down_revision = "e2451bd1d949"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column(
            "template_id",
            sa.UUID(),
            sa.ForeignKey("templates.id"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("projects", "template_id")

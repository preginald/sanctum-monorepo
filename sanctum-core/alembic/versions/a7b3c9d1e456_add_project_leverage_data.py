"""add project leverage_data

Revision ID: a7b3c9d1e456
Revises: f3a1c7b9d042
Create Date: 2026-04-07

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "a7b3c9d1e456"
down_revision = "f3a1c7b9d042"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("leverage_data", JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("projects", "leverage_data")

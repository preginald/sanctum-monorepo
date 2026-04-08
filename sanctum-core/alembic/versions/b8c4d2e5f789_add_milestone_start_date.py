"""add milestone start_date

Revision ID: b8c4d2e5f789
Revises: a7b3c9d1e456
Create Date: 2026-04-08

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "b8c4d2e5f789"
down_revision = "a7b3c9d1e456"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("milestones", sa.Column("start_date", sa.Date(), nullable=True))


def downgrade():
    op.drop_column("milestones", "start_date")

"""add_previous_status_and_migrate_qa

Revision ID: a3b7c9d2e4f6
Revises: 91bf02cbb5f0
Create Date: 2026-03-25 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a3b7c9d2e4f6'
down_revision: Union[str, None] = '91bf02cbb5f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add previous_status column for pending hold/resume
    op.add_column('tickets', sa.Column('previous_status', sa.String(), nullable=True))

    # Migrate any tickets with status 'qa' to 'verification'
    op.execute("UPDATE tickets SET status = 'verification' WHERE status = 'qa'")


def downgrade() -> None:
    # Revert verification back to qa
    op.execute("UPDATE tickets SET status = 'qa' WHERE status = 'verification'")

    # Drop previous_status column
    op.drop_column('tickets', 'previous_status')

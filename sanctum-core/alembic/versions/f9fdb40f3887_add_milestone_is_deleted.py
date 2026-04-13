"""add_milestone_is_deleted

Revision ID: f9fdb40f3887
Revises: b8c4d2e5f789
Create Date: 2026-04-13

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f9fdb40f3887'
down_revision: Union[str, None] = 'b8c4d2e5f789'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name = 'milestones' AND column_name = 'is_deleted'"
    ))
    if result.fetchone() is None:
        op.add_column('milestones', sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'))

    # Create partial index if it doesn't already exist
    result = conn.execute(sa.text(
        "SELECT indexname FROM pg_indexes "
        "WHERE tablename = 'milestones' AND indexname = 'ix_milestones_is_deleted'"
    ))
    if result.fetchone() is None:
        op.create_index('ix_milestones_is_deleted', 'milestones', ['is_deleted'], postgresql_where=sa.text('is_deleted = FALSE'))


def downgrade() -> None:
    op.drop_index('ix_milestones_is_deleted', table_name='milestones')
    op.drop_column('milestones', 'is_deleted')

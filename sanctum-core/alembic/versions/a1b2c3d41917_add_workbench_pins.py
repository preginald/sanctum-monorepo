"""add_workbench_pins

Revision ID: a1b2c3d41917
Revises: f9fdb40f3887
Create Date: 2026-04-13

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d41917'
down_revision: Union[str, None] = 'f9fdb40f3887'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'workbench_pins',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('pinned_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('user_id', 'project_id', name='uq_workbench_pins_user_project'),
    )
    op.create_index('ix_workbench_pins_user', 'workbench_pins', ['user_id'])
    op.create_index('ix_workbench_pins_project', 'workbench_pins', ['project_id'])


def downgrade() -> None:
    op.drop_index('ix_workbench_pins_project', table_name='workbench_pins')
    op.drop_index('ix_workbench_pins_user', table_name='workbench_pins')
    op.drop_table('workbench_pins')

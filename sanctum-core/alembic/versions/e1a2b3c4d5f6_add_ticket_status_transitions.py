"""add_ticket_status_transitions

Revision ID: e1a2b3c4d5f6
Revises: d7f1a2b3c4e5
Create Date: 2026-03-26 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e1a2b3c4d5f6'
down_revision: Union[str, None] = 'd7f1a2b3c4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ticket_status_transitions',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('ticket_id', sa.Integer(), nullable=False),
        sa.Column('from_status', sa.String(), nullable=True),
        sa.Column('to_status', sa.String(), nullable=False),
        sa.Column('changed_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('changed_by', sa.String(), nullable=False, server_default=sa.text("'system'")),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['ticket_id'], ['tickets.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_ticket_status_transitions_ticket_changed',
        'ticket_status_transitions',
        ['ticket_id', 'changed_at'],
    )


def downgrade() -> None:
    op.drop_index('ix_ticket_status_transitions_ticket_changed', table_name='ticket_status_transitions')
    op.drop_table('ticket_status_transitions')

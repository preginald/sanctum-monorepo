"""add rate_cards table

Revision ID: a1b2c3d4e5f6
Revises: 0aac40e8a806
Create Date: 2026-03-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '0aac40e8a806'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'rate_cards',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('account_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('accounts.id'), nullable=True),
        sa.Column('tier', sa.String(), nullable=False),
        sa.Column('hourly_rate', sa.Numeric(8, 2), nullable=False),
        sa.Column('effective_from', sa.Date(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )

    # Seed system default rates (BUS-001 D4)
    op.execute("""
        INSERT INTO rate_cards (tier, hourly_rate, effective_from) VALUES
        ('project_delivery', 250.00, '2026-01-01'),
        ('reactive', 175.00, '2026-01-01'),
        ('consulting', 300.00, '2026-01-01'),
        ('internal', 0.00, '2026-01-01')
    """)


def downgrade() -> None:
    op.drop_table('rate_cards')

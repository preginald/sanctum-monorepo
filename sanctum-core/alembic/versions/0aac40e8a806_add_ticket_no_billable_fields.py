"""add ticket no_billable fields

Revision ID: 0aac40e8a806
Revises: 9bc5d937ca4f
Create Date: 2026-03-22

"""
from alembic import op
import sqlalchemy as sa


revision = '0aac40e8a806'
down_revision = '9bc5d937ca4f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('tickets', sa.Column('no_billable', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('tickets', sa.Column('no_billable_reason', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('tickets', 'no_billable_reason')
    op.drop_column('tickets', 'no_billable')

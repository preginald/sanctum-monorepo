"""add project budget fields

Revision ID: 9bc5d937ca4f
Revises: c4e7f9a21b03
Create Date: 2026-03-21

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9bc5d937ca4f'
down_revision = 'c4e7f9a21b03'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('projects', sa.Column('market_value', sa.Numeric(12, 2), nullable=True))
    op.add_column('projects', sa.Column('quoted_price', sa.Numeric(12, 2), nullable=True))
    op.add_column('projects', sa.Column('discount_amount', sa.Numeric(12, 2), nullable=True))
    op.add_column('projects', sa.Column('discount_reason', sa.Text(), nullable=True))
    op.add_column('projects', sa.Column('pricing_model', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('projects', 'pricing_model')
    op.drop_column('projects', 'discount_reason')
    op.drop_column('projects', 'discount_amount')
    op.drop_column('projects', 'quoted_price')
    op.drop_column('projects', 'market_value')

"""add_vendors_table

Revision ID: de4e5a387b79
Revises: ec65c8baf023
Create Date: 2026-02-13 00:16:00.533588

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ARRAY


# revision identifiers, used by Alembic.
revision: str = 'de4e5a387b79'
down_revision: Union[str, None] = 'ec65c8baf023'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'vendors',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False, unique=True),
        sa.Column('category', sa.String(50), nullable=False, index=True),
        sa.Column('website', sa.String(255)),
        sa.Column('support_email', sa.String(255)),
        sa.Column('support_phone', sa.String(100)),
        sa.Column('account_manager_contact', sa.String(255)),
        sa.Column('typical_renewal_cycle', sa.Integer),
        sa.Column('typical_pricing_model', sa.String(50)),
        sa.Column('base_price_aud', sa.Numeric(10, 2)),
        sa.Column('pricing_notes', sa.Text),
        sa.Column('logo_url', sa.String(500)),
        sa.Column('description', sa.Text),
        sa.Column('tags', ARRAY(sa.String)),
        sa.Column('is_active', sa.Boolean, default=True, index=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), onupdate=sa.func.now())
    )
    
    # Add index on category for faster filtering
    op.create_index('idx_vendors_category', 'vendors', ['category'])
    op.create_index('idx_vendors_name', 'vendors', ['name'])


def downgrade():
    op.drop_index('idx_vendors_name')
    op.drop_index('idx_vendors_category')
    op.drop_table('vendors')

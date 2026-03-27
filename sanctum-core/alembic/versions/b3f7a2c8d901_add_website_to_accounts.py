"""add website to accounts

Revision ID: b3f7a2c8d901
Revises: 9861219f2d40
Create Date: 2026-03-27 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3f7a2c8d901'
down_revision: Union[str, None] = '9861219f2d40'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('accounts', sa.Column('website', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('accounts', 'website')

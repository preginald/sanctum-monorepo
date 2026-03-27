"""add oauth_client_id to accounts

Revision ID: 2584e253fb63
Revises: ec65c8baf023
Create Date: 2026-03-28 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2584e253fb63'
down_revision: Union[str, None] = 'ec65c8baf023'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('accounts', sa.Column('oauth_client_id', sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column('accounts', 'oauth_client_id')

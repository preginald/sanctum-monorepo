"""merge heads: status transitions + cached_rate

Revision ID: 4cf49031a18b
Revises: e1a2b3c4d5f6, e8f9a1b2c3d4
Create Date: 2026-03-26 12:58:33.213248

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4cf49031a18b'
down_revision: Union[str, None] = ('e1a2b3c4d5f6', 'e8f9a1b2c3d4')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

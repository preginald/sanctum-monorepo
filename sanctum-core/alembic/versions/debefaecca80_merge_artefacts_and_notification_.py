"""merge artefacts and notification frequency heads

Revision ID: debefaecca80
Revises: 64cc44c47f85, a1b2c3d4e5f6
Create Date: 2026-03-19 23:55:31.447170

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'debefaecca80'
down_revision: Union[str, None] = ('64cc44c47f85', 'a1b2c3d4e5f6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

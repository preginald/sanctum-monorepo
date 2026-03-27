"""merge_oauth_and_health_scan

Revision ID: e2451bd1d949
Revises: 2584e253fb63, d7f2e9b34c12
Create Date: 2026-03-28 08:40:47.978835

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2451bd1d949'
down_revision: Union[str, None] = ('2584e253fb63', 'd7f2e9b34c12')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

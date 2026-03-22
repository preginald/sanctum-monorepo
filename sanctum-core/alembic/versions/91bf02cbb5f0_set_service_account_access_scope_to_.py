"""set service account access_scope to global

Revision ID: 91bf02cbb5f0
Revises: b3ad0c790c61
Create Date: 2026-03-22 14:55:10.812762

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '91bf02cbb5f0'
down_revision: Union[str, None] = 'b3ad0c790c61'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "UPDATE users SET access_scope = 'global' "
        "WHERE user_type = 'service_account' AND (access_scope IS NULL OR access_scope != 'global')"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE users SET access_scope = NULL "
        "WHERE user_type = 'service_account' AND access_scope = 'global'"
    )

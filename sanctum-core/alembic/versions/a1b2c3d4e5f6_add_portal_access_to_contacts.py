"""add portal_access to contacts

Revision ID: a1b2c3d4e5f6
Revises: 4cf49031a18b
Create Date: 2026-03-27 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '4cf49031a18b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('contacts', sa.Column('portal_access', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    # NOTE: Existing contacts who were created with enable_portal_access=True
    # will have portal_access=False here (migration default). A follow-up ticket
    # should run: UPDATE contacts SET portal_access = true
    #             WHERE email IN (SELECT email FROM users WHERE role = 'client');


def downgrade() -> None:
    op.drop_column('contacts', 'portal_access')

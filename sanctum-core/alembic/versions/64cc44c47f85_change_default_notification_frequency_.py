"""change_default_notification_frequency_to_daily

Revision ID: 64cc44c47f85
Revises: 81566a52c5f9
Create Date: 2026-03-16 09:47:35.034803

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '64cc44c47f85'
down_revision: Union[str, None] = '81566a52c5f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Update existing client-role users from realtime to daily digest
    op.execute("""
        UPDATE user_notification_preferences
        SET email_frequency = 'daily'
        WHERE email_frequency = 'realtime'
        AND user_id IN (
            SELECT id FROM users WHERE role = 'client'
        )
    """)


def downgrade() -> None:
    # Revert client users back to realtime
    op.execute("""
        UPDATE user_notification_preferences
        SET email_frequency = 'realtime'
        WHERE email_frequency = 'daily'
        AND user_id IN (
            SELECT id FROM users WHERE role = 'client'
        )
    """)

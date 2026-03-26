"""add cached_rate to ticket_time_entries

Revision ID: e8f9a1b2c3d4
Revises: d7f1a2b3c4e5
Create Date: 2026-03-26 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8f9a1b2c3d4'
down_revision: Union[str, None] = 'd7f1a2b3c4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add the cached_rate column
    op.add_column('ticket_time_entries', sa.Column('cached_rate', sa.Numeric(8, 2), nullable=True))

    # 2. Backfill cached_rate for existing entries where product_id IS NULL.
    # Uses the rate card lookup logic: account override first, then system default.
    # The rate card effective at the time entry's start_time is used (correct accounting).
    # Tier selection: 'internal' for no_billable tickets, 'project_delivery' otherwise.
    op.execute(sa.text("""
        UPDATE ticket_time_entries tte
        SET cached_rate = COALESCE(
            -- Try account-specific rate card first
            (
                SELECT rc.hourly_rate
                FROM rate_cards rc
                JOIN tickets t ON t.id = tte.ticket_id
                WHERE rc.account_id = t.account_id
                  AND rc.tier = CASE WHEN t.no_billable THEN 'internal' ELSE 'project_delivery' END
                  AND rc.effective_from <= tte.start_time::date
                ORDER BY rc.effective_from DESC
                LIMIT 1
            ),
            -- Fall back to system default rate card
            (
                SELECT rc.hourly_rate
                FROM rate_cards rc
                JOIN tickets t ON t.id = tte.ticket_id
                WHERE rc.account_id IS NULL
                  AND rc.tier = CASE WHEN t.no_billable THEN 'internal' ELSE 'project_delivery' END
                  AND rc.effective_from <= tte.start_time::date
                ORDER BY rc.effective_from DESC
                LIMIT 1
            )
        )
        WHERE tte.product_id IS NULL
    """))


def downgrade() -> None:
    op.drop_column('ticket_time_entries', 'cached_rate')

"""add phase_criteria JSONB column to tickets

Revision ID: c7d8e9f0a1b2
Revises: e4f5a6b7c8d9
Create Date: 2026-04-24

Adds a nullable ``phase_criteria`` JSONB column to the ``tickets`` table with
an empty-object server default so existing rows materialise with ``{}`` rather
than NULL. The column backs the phase-gated acceptance criteria model designed
in #2873 and implemented in #2875.

Pre-flight: aborts if any tickets still carry the legacy ``qa`` status.
Historical ``closed`` rows are tolerated — the ``closed`` zombie is purged
separately in #3028 after the 2026-10-31 deprecation window.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'c7d8e9f0a1b2'
down_revision = 'e4f5a6b7c8d9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Pre-flight: refuse to migrate if any legacy 'qa' rows exist. Historical
    # 'closed' rows are tolerated (read-tolerance window closes in #3028).
    bind = op.get_bind()
    qa_count = bind.execute(
        sa.text("SELECT COUNT(*) FROM tickets WHERE status = 'qa'")
    ).scalar() or 0
    if qa_count > 0:
        raise RuntimeError(
            f"Cannot migrate: {qa_count} ticket(s) still carry legacy status "
            "'qa'. Run a data migration to move these to a valid status "
            "before applying this revision."
        )

    op.add_column(
        'tickets',
        sa.Column(
            'phase_criteria',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column('tickets', 'phase_criteria')

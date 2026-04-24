"""add mirror flag to comments

Revision ID: d0e1f2a3b4c5
Revises: c7d8e9f0a1b2
Create Date: 2026-04-24

Adds a boolean ``mirror`` column to the ``comments`` table to support the
Mirror Comment gate designed in #2874 and implemented in #2876 (Gate 3).
The column is non-nullable with a server default of FALSE so existing rows
backfill to False without an explicit UPDATE.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd0e1f2a3b4c5'
down_revision = 'c7d8e9f0a1b2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name = 'comments' AND column_name = 'mirror'"
    ))
    if result.fetchone() is None:
        op.add_column(
            'comments',
            sa.Column(
                'mirror',
                sa.Boolean(),
                nullable=False,
                server_default=sa.text('false'),
            ),
        )


def downgrade() -> None:
    op.drop_column('comments', 'mirror')

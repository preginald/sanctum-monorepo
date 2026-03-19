"""add artefact_history table and version column on artefacts

Revision ID: 11a60abce5d5
Revises: d0723c39cf35
Create Date: 2026-03-20

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '11a60abce5d5'
down_revision = 'd0723c39cf35'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add version column to artefacts
    op.execute("ALTER TABLE artefacts ADD COLUMN version varchar DEFAULT 'v1.0'")

    # Create artefact_history table
    op.execute("""
        CREATE TABLE artefact_history (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            artefact_id uuid NOT NULL REFERENCES artefacts(id) ON DELETE CASCADE,
            name varchar NOT NULL,
            content text,
            version varchar NOT NULL,
            snapshot_at timestamptz NOT NULL DEFAULT now(),
            author_id uuid REFERENCES users(id) ON DELETE SET NULL,
            author_name varchar,
            change_comment text,
            diff_before text,
            diff_after text
        )
    """)
    op.execute("CREATE INDEX ix_artefact_history_artefact_id ON artefact_history (artefact_id)")
    op.execute("CREATE INDEX ix_artefact_history_snapshot_at ON artefact_history (snapshot_at DESC)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS artefact_history")
    op.execute("ALTER TABLE artefacts DROP COLUMN IF EXISTS version")

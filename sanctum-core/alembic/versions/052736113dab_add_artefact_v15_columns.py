"""add artefact v1.5 columns — content, status, category, sensitivity, metadata, mime_type, file_size, superseded_by

Revision ID: 052736113dab
Revises: debefaecca80
Create Date: 2026-03-20

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '052736113dab'
down_revision = 'debefaecca80'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enums first
    op.execute("CREATE TYPE artefact_status AS ENUM ('draft', 'review', 'approved', 'archived', 'superseded')")
    op.execute("CREATE TYPE artefact_sensitivity AS ENUM ('public', 'internal', 'confidential')")

    # Add columns
    op.execute("ALTER TABLE artefacts ADD COLUMN content text")
    op.execute("ALTER TABLE artefacts ADD COLUMN status artefact_status NOT NULL DEFAULT 'draft'")
    op.execute("ALTER TABLE artefacts ADD COLUMN category varchar(100)")
    op.execute("ALTER TABLE artefacts ADD COLUMN sensitivity artefact_sensitivity NOT NULL DEFAULT 'internal'")
    op.execute("ALTER TABLE artefacts ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'")
    op.execute("ALTER TABLE artefacts ADD COLUMN mime_type varchar(100)")
    op.execute("ALTER TABLE artefacts ADD COLUMN file_size bigint")
    op.execute("ALTER TABLE artefacts ADD COLUMN superseded_by uuid REFERENCES artefacts(id) ON DELETE SET NULL")

    # Indexes for filtered list views
    op.execute("CREATE INDEX ix_artefacts_status ON artefacts (status)")
    op.execute("CREATE INDEX ix_artefacts_category ON artefacts (category)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_artefacts_category")
    op.execute("DROP INDEX IF EXISTS ix_artefacts_status")

    op.execute("ALTER TABLE artefacts DROP COLUMN IF EXISTS superseded_by")
    op.execute("ALTER TABLE artefacts DROP COLUMN IF EXISTS file_size")
    op.execute("ALTER TABLE artefacts DROP COLUMN IF EXISTS mime_type")
    op.execute("ALTER TABLE artefacts DROP COLUMN IF EXISTS metadata")
    op.execute("ALTER TABLE artefacts DROP COLUMN IF EXISTS sensitivity")
    op.execute("ALTER TABLE artefacts DROP COLUMN IF EXISTS category")
    op.execute("ALTER TABLE artefacts DROP COLUMN IF EXISTS status")
    op.execute("ALTER TABLE artefacts DROP COLUMN IF EXISTS content")

    op.execute("DROP TYPE IF EXISTS artefact_sensitivity")
    op.execute("DROP TYPE IF EXISTS artefact_status")

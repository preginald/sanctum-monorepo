"""add_artefacts

Revision ID: a1b2c3d4e5f6
Revises: fc78ff647823
Create Date: 2026-03-19 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'fc78ff647823'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Fully idempotent via raw SQL — SQLAlchemy's create_type=False is unreliable
    op.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE artefact_type_enum AS ENUM ('file', 'url', 'code_path', 'document', 'credential_ref');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
    """))
    op.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE artefact_link_entity_type AS ENUM ('ticket', 'account', 'article');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
    """))

    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS artefacts (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            name VARCHAR NOT NULL,
            artefact_type artefact_type_enum NOT NULL,
            url VARCHAR,
            description TEXT,
            account_id UUID REFERENCES accounts(id),
            created_by UUID REFERENCES users(id),
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ,
            is_deleted BOOLEAN DEFAULT false
        )
    """))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_artefacts_account_id ON artefacts (account_id)"))

    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS artefact_links (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            artefact_id UUID NOT NULL REFERENCES artefacts(id),
            linked_entity_type artefact_link_entity_type NOT NULL,
            linked_entity_id VARCHAR NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now()
        )
    """))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_artefact_links_entity ON artefact_links (linked_entity_type, linked_entity_id)"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_artefact_links_artefact_id ON artefact_links (artefact_id)"))
    op.execute(sa.text("CREATE UNIQUE INDEX IF NOT EXISTS uq_artefact_links ON artefact_links (artefact_id, linked_entity_type, linked_entity_id)"))

    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_trgm_artefact_name ON artefacts USING gin (name gin_trgm_ops)"))


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_trgm_artefact_name")
    op.drop_table('artefact_links')
    op.drop_table('artefacts')
    op.execute("DROP TYPE IF EXISTS artefact_link_entity_type")
    op.execute("DROP TYPE IF EXISTS artefact_type_enum")

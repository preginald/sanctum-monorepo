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
    # Create enums
    artefact_type_enum = sa.Enum(
        'file', 'url', 'code_path', 'document', 'credential_ref',
        name='artefact_type_enum'
    )
    artefact_link_entity_type = sa.Enum(
        'ticket', 'account', 'article',
        name='artefact_link_entity_type'
    )
    artefact_type_enum.create(op.get_bind(), checkfirst=True)
    artefact_link_entity_type.create(op.get_bind(), checkfirst=True)

    # Create artefacts table
    op.create_table(
        'artefacts',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('artefact_type', artefact_type_enum, nullable=False),
        sa.Column('url', sa.String(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('account_id', UUID(as_uuid=True), sa.ForeignKey('accounts.id'), nullable=True),
        sa.Column('created_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), server_default='false'),
    )
    op.create_index('ix_artefacts_account_id', 'artefacts', ['account_id'])

    # Create artefact_links table
    op.create_table(
        'artefact_links',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column('artefact_id', UUID(as_uuid=True), sa.ForeignKey('artefacts.id'), nullable=False),
        sa.Column('linked_entity_type', artefact_link_entity_type, nullable=False),
        sa.Column('linked_entity_id', sa.String(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_artefact_links_entity', 'artefact_links', ['linked_entity_type', 'linked_entity_id'])
    op.create_index('ix_artefact_links_artefact_id', 'artefact_links', ['artefact_id'])
    op.create_index('uq_artefact_links', 'artefact_links', ['artefact_id', 'linked_entity_type', 'linked_entity_id'], unique=True)

    # Trigram index for omnisearch
    op.execute("CREATE INDEX ix_trgm_artefact_name ON artefacts USING gin (name gin_trgm_ops)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_trgm_artefact_name")
    op.drop_table('artefact_links')
    op.drop_table('artefacts')
    op.execute("DROP TYPE IF EXISTS artefact_link_entity_type")
    op.execute("DROP TYPE IF EXISTS artefact_type_enum")

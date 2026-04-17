"""add notification project_id

Revision ID: e4f5a6b7c8d9
Revises: d7a8b9c10e11
Create Date: 2026-04-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = 'e4f5a6b7c8d9'
down_revision = 'd7a8b9c10e11'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('notifications', sa.Column('project_id', UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'fk_notifications_project_id',
        'notifications', 'projects',
        ['project_id'], ['id'],
        ondelete='SET NULL',
    )
    op.create_index('ix_notifications_project_id', 'notifications', ['project_id'])


def downgrade() -> None:
    op.drop_index('ix_notifications_project_id', table_name='notifications')
    op.drop_constraint('fk_notifications_project_id', 'notifications', type_='foreignkey')
    op.drop_column('notifications', 'project_id')

"""add unique constraint on articles.identifier

Revision ID: a742b001c001
Revises: 11a60abce5d5
Create Date: 2026-03-21

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'a742b001c001'
down_revision = '11a60abce5d5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint('uq_articles_identifier', 'articles', ['identifier'])


def downgrade() -> None:
    op.drop_constraint('uq_articles_identifier', 'articles', type_='unique')

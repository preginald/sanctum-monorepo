"""seed website health scan template

Revision ID: a2900e459652
Revises: 65cb17962080
Create Date: 2026-03-28

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'a2900e459652'
down_revision = '65cb17962080'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        INSERT INTO audit_templates (name, framework, description, category, category_structure, scan_mode, is_active)
        SELECT
            'Website Health Scan',
            'Sanctum Audit',
            'Automated website health scan via Sanctum Audit API. Scores across SEO, security, performance, accessibility, and more.',
            'website',
            '[]'::json,
            'automated',
            true
        WHERE NOT EXISTS (
            SELECT 1 FROM audit_templates WHERE framework = 'Sanctum Audit'
        )
    """)


def downgrade() -> None:
    op.execute("DELETE FROM audit_templates WHERE framework = 'Sanctum Audit'")

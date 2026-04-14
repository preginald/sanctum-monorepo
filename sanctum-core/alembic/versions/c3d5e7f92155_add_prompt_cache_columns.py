"""add prompt cache columns to mcp_tool_calls

Revision ID: c3d5e7f92155
Revises: a1b2c3d41917
Create Date: 2026-04-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c3d5e7f92155"
down_revision: Union[str, None] = "a1b2c3d41917"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("mcp_tool_calls", sa.Column("input_tokens", sa.Integer(), nullable=True))
    op.add_column("mcp_tool_calls", sa.Column("cache_read_input_tokens", sa.Integer(), nullable=True))
    op.add_column("mcp_tool_calls", sa.Column("cache_creation_input_tokens", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("mcp_tool_calls", "cache_creation_input_tokens")
    op.drop_column("mcp_tool_calls", "cache_read_input_tokens")
    op.drop_column("mcp_tool_calls", "input_tokens")

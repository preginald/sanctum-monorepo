"""add_mcp_tool_calls

Revision ID: d7f1a2b3c4e5
Revises: a3b7c9d2e4f6
Create Date: 2026-03-26 08:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd7f1a2b3c4e5'
down_revision: Union[str, None] = 'a3b7c9d2e4f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'mcp_tool_calls',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('called_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('tool_name', sa.String(), nullable=False),
        sa.Column('cost_tier', sa.String(), nullable=True),
        sa.Column('agent_persona', sa.String(), nullable=True),
        sa.Column('session_id', sa.String(), nullable=True),
        sa.Column('latency_ms', sa.Integer(), nullable=False),
        sa.Column('response_bytes', sa.Integer(), nullable=True),
        sa.Column('token_estimate', sa.Integer(), nullable=True),
        sa.Column('http_calls', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('status', sa.String(), nullable=False, server_default='success'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    # Composite index for time-windowed stats aggregation by tool
    op.create_index('ix_mcp_tool_calls_called_at_tool_name', 'mcp_tool_calls', ['called_at', 'tool_name'])
    # Single-column index for agent filtering
    op.create_index('ix_mcp_tool_calls_agent_persona', 'mcp_tool_calls', ['agent_persona'])


def downgrade() -> None:
    op.drop_index('ix_mcp_tool_calls_agent_persona', table_name='mcp_tool_calls')
    op.drop_index('ix_mcp_tool_calls_called_at_tool_name', table_name='mcp_tool_calls')
    op.drop_table('mcp_tool_calls')

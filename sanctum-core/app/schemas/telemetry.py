"""Pydantic schemas for MCP usage telemetry (#950)."""

from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field
from typing import Optional


class McpToolCallCreate(BaseModel):
    tool_name: str
    cost_tier: Optional[str] = None
    agent_persona: Optional[str] = None
    session_id: Optional[str] = None
    latency_ms: int
    response_bytes: Optional[int] = None
    token_estimate: Optional[int] = None
    http_calls: int = 1
    status: str = "success"
    error_message: Optional[str] = None


class McpToolCallBatchCreate(BaseModel):
    records: list[McpToolCallCreate]


class McpToolCallRead(BaseModel):
    id: UUID
    called_at: datetime
    tool_name: str
    cost_tier: Optional[str]
    agent_persona: Optional[str]
    session_id: Optional[str]
    latency_ms: int
    response_bytes: Optional[int]
    token_estimate: Optional[int]
    http_calls: int
    status: str
    error_message: Optional[str]

    class Config:
        from_attributes = True


class McpToolCallStats(BaseModel):
    tool_name: str
    call_count: int
    avg_latency_ms: float
    p95_latency_ms: Optional[float] = None
    avg_response_bytes: Optional[float] = None
    error_count: int = 0
    error_rate: float = 0.0
    total_token_estimate: Optional[int] = None

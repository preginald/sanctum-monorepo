"""MCP usage telemetry router (#950).

Provides ingest endpoints for the MCP server to POST tool-call metrics,
and query endpoints for admin users to view aggregated stats.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case, desc
from datetime import datetime, timedelta, timezone
from typing import Optional

from .. import models, auth
from ..database import get_db
from ..schemas.telemetry import (
    McpToolCallCreate,
    McpToolCallBatchCreate,
    McpToolCallRead,
    McpToolCallStats,
)

router = APIRouter(prefix="/mcp/telemetry", tags=["MCP Telemetry"])

# ── Ingest (API token auth — same as all MCP->Core calls) ──────────────

@router.post("/ingest")
def ingest_single(
    payload: McpToolCallCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.get_current_active_user),
):
    """Accept a single telemetry record from the MCP server."""
    record = models.McpToolCall(**payload.model_dump())
    db.add(record)
    db.commit()
    return {"status": "ok", "count": 1}


@router.post("/ingest/batch")
def ingest_batch(
    payload: McpToolCallBatchCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.get_current_active_user),
):
    """Accept a batch of telemetry records from the MCP server."""
    records = [models.McpToolCall(**r.model_dump()) for r in payload.records]
    db.add_all(records)
    db.commit()
    return {"status": "ok", "count": len(records)}


# ── Query (admin auth) ─────────────────────────────────────────────────

@router.get("/calls", response_model=list[McpToolCallRead])
def list_calls(
    tool_name: Optional[str] = None,
    agent_persona: Optional[str] = None,
    session_id: Optional[str] = None,
    window: Optional[str] = Query(None, description="Time window: 1d, 7d, 30d"),
    limit: int = Query(50, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.get_current_active_user),
):
    """Paginated raw telemetry records with optional filters."""
    q = db.query(models.McpToolCall)

    if tool_name:
        q = q.filter(models.McpToolCall.tool_name == tool_name)
    if agent_persona:
        q = q.filter(models.McpToolCall.agent_persona == agent_persona)
    if session_id:
        q = q.filter(models.McpToolCall.session_id == session_id)
    if window:
        cutoff = _window_cutoff(window)
        if cutoff:
            q = q.filter(models.McpToolCall.called_at >= cutoff)

    return q.order_by(desc(models.McpToolCall.called_at)).offset(offset).limit(limit).all()


@router.get("/stats", response_model=list[McpToolCallStats])
def get_stats(
    window: str = Query("7d", description="Time window: 1d, 7d, 30d"),
    group_by: str = Query("tool_name", description="Group by: tool_name, agent_persona, cost_tier"),
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.get_current_active_user),
):
    """Aggregated telemetry stats grouped by the specified dimension."""
    cutoff = _window_cutoff(window)

    # Determine grouping column
    group_col = {
        "tool_name": models.McpToolCall.tool_name,
        "agent_persona": models.McpToolCall.agent_persona,
        "cost_tier": models.McpToolCall.cost_tier,
    }.get(group_by, models.McpToolCall.tool_name)

    q = db.query(
        group_col.label("group_key"),
        func.count().label("call_count"),
        func.avg(models.McpToolCall.latency_ms).label("avg_latency_ms"),
        func.percentile_cont(0.95).within_group(
            models.McpToolCall.latency_ms
        ).label("p95_latency_ms"),
        func.avg(models.McpToolCall.response_bytes).label("avg_response_bytes"),
        func.sum(
            case((models.McpToolCall.status == "error", 1), else_=0)
        ).label("error_count"),
        func.sum(models.McpToolCall.token_estimate).label("total_token_estimate"),
        func.sum(models.McpToolCall.input_tokens).label("total_input_tokens"),
        func.sum(models.McpToolCall.cache_read_input_tokens).label("total_cache_read_input_tokens"),
        func.sum(models.McpToolCall.cache_creation_input_tokens).label("total_cache_creation_input_tokens"),
    )

    if cutoff:
        q = q.filter(models.McpToolCall.called_at >= cutoff)

    q = q.filter(group_col.isnot(None))
    rows = q.group_by(group_col).order_by(desc(func.count())).all()

    results = []
    for r in rows:
        error_rate = (r.error_count / r.call_count * 100) if r.call_count else 0.0
        # Cache hit rate: cache_read / (input + cache_read + cache_creation) * 100
        t_input = r.total_input_tokens or 0
        t_cache_read = r.total_cache_read_input_tokens or 0
        t_cache_creation = r.total_cache_creation_input_tokens or 0
        total_cache_tokens = t_input + t_cache_read + t_cache_creation
        cache_hit_rate = round((t_cache_read / total_cache_tokens) * 100, 2) if total_cache_tokens > 0 else None

        results.append(McpToolCallStats(
            tool_name=r.group_key,
            call_count=r.call_count,
            avg_latency_ms=round(float(r.avg_latency_ms or 0), 1),
            p95_latency_ms=round(float(r.p95_latency_ms or 0), 1) if r.p95_latency_ms else None,
            avg_response_bytes=round(float(r.avg_response_bytes or 0), 1) if r.avg_response_bytes else None,
            error_count=r.error_count,
            error_rate=round(error_rate, 2),
            total_token_estimate=r.total_token_estimate,
            total_input_tokens=r.total_input_tokens,
            total_cache_read_input_tokens=r.total_cache_read_input_tokens,
            total_cache_creation_input_tokens=r.total_cache_creation_input_tokens,
            cache_hit_rate=cache_hit_rate,
        ))
    return results


def _window_cutoff(window: str) -> Optional[datetime]:
    """Parse a time window string into a UTC cutoff datetime."""
    mapping = {"1d": 1, "7d": 7, "30d": 30, "90d": 90}
    days = mapping.get(window)
    if days:
        return datetime.now(timezone.utc) - timedelta(days=days)
    return None

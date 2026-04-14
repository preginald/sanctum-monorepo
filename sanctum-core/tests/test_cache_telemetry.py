"""Unit tests for prompt cache telemetry (#2155).

Tests the cache hit rate calculation and schema handling:
1. Cache hit rate with mixed token data
2. Cache hit rate is None when no cache data present
3. 100% cache hit rate (all reads, no creation or uncached)
4. Schema accepts cache fields on create (backward compat)
5. Schema defaults cache fields to None when omitted
"""

import pytest
from typing import Optional


# ---------------------------------------------------------------------------
# Pure cache_hit_rate calculation extracted from router logic
# ---------------------------------------------------------------------------

def compute_cache_hit_rate(
    total_input_tokens: Optional[int],
    total_cache_read_input_tokens: Optional[int],
    total_cache_creation_input_tokens: Optional[int],
) -> Optional[float]:
    """Mirror of the cache hit rate formula in mcp_telemetry.py stats endpoint."""
    t_input = total_input_tokens or 0
    t_cache_read = total_cache_read_input_tokens or 0
    t_cache_creation = total_cache_creation_input_tokens or 0
    total = t_input + t_cache_read + t_cache_creation
    if total > 0:
        return round((t_cache_read / total) * 100, 2)
    return None


# ---------------------------------------------------------------------------
# Test 1: Mixed token data produces correct hit rate
# ---------------------------------------------------------------------------

def test_cache_hit_rate_mixed_tokens():
    """input=200, cache_read=600, cache_creation=200 => 600/1000 = 60%."""
    rate = compute_cache_hit_rate(200, 600, 200)
    assert rate == 60.0


# ---------------------------------------------------------------------------
# Test 2: No cache data => None
# ---------------------------------------------------------------------------

def test_cache_hit_rate_no_data():
    """All None => rate is None (not 0)."""
    rate = compute_cache_hit_rate(None, None, None)
    assert rate is None


# ---------------------------------------------------------------------------
# Test 3: 100% cache hit rate
# ---------------------------------------------------------------------------

def test_cache_hit_rate_100_percent():
    """All tokens are cache reads => 100%."""
    rate = compute_cache_hit_rate(0, 5000, 0)
    assert rate == 100.0


# ---------------------------------------------------------------------------
# Test 4: Schema accepts cache fields on create
# ---------------------------------------------------------------------------

def test_schema_create_with_cache_fields():
    """McpToolCallCreate accepts the new cache fields."""
    from app.schemas.telemetry import McpToolCallCreate

    payload = McpToolCallCreate(
        tool_name="ticket_show",
        latency_ms=150,
        input_tokens=200,
        cache_read_input_tokens=600,
        cache_creation_input_tokens=200,
    )
    assert payload.input_tokens == 200
    assert payload.cache_read_input_tokens == 600
    assert payload.cache_creation_input_tokens == 200


# ---------------------------------------------------------------------------
# Test 5: Schema defaults cache fields to None (backward compat)
# ---------------------------------------------------------------------------

def test_schema_create_without_cache_fields():
    """McpToolCallCreate works without cache fields (backward compat)."""
    from app.schemas.telemetry import McpToolCallCreate

    payload = McpToolCallCreate(
        tool_name="ticket_show",
        latency_ms=150,
    )
    assert payload.input_tokens is None
    assert payload.cache_read_input_tokens is None
    assert payload.cache_creation_input_tokens is None

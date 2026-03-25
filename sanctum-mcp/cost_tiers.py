"""Cost-tier annotations for MCP tools.

Provides pre-built ToolAnnotations constants that classify each tool by its
cost profile. Orchestrators use these annotations to make informed model-routing
decisions (e.g. delegate cheap reads to Haiku, expensive writes to Opus).

Tiers:
  light       - List, search, simple read operations (cheapest)
  standard    - Show operations with expand support (moderate)
  heavy       - Create, update, comment, resolve, revert (expensive)
  destructive - Delete operations (expensive + irreversible)
"""

from mcp.types import ToolAnnotations

# ── Tier Constants ────────────────────────────────────────────────

LIGHT_READ = ToolAnnotations(
    readOnlyHint=True,
    destructiveHint=False,
    idempotentHint=True,
    openWorldHint=False,
    cost_tier="light",
)

STANDARD_READ = ToolAnnotations(
    readOnlyHint=True,
    destructiveHint=False,
    idempotentHint=True,
    openWorldHint=False,
    cost_tier="standard",
)

HEAVY_WRITE = ToolAnnotations(
    readOnlyHint=False,
    destructiveHint=False,
    idempotentHint=False,
    openWorldHint=False,
    cost_tier="heavy",
)

HEAVY_IDEMPOTENT = ToolAnnotations(
    readOnlyHint=False,
    destructiveHint=False,
    idempotentHint=True,
    openWorldHint=False,
    cost_tier="heavy",
)

DESTRUCTIVE = ToolAnnotations(
    readOnlyHint=False,
    destructiveHint=True,
    idempotentHint=False,
    openWorldHint=False,
    cost_tier="destructive",
)

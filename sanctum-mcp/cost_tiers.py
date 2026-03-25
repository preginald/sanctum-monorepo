"""Cost-tier constants for MCP tool annotations.

Each tier maps to a pre-built ToolAnnotations object that encodes both the
MCP spec hints (readOnlyHint, destructiveHint, idempotentHint) and a custom
``costTier`` field consumed by the agent-model router.

Tiers
-----
LIGHT       Simple reads — list, show, search.  Suitable for Haiku-class models.
STANDARD    Reads that may return large content or require reasoning.  Sonnet-class.
HEAVY       Write operations — create, update, comment, link.  Opus-class.
DESTRUCTIVE Delete, revert, unlink operations.  Opus-class, requires confirmation.
"""

from mcp.types import ToolAnnotations

# ---------------------------------------------------------------------------
# Tier definitions
# ---------------------------------------------------------------------------

LIGHT = ToolAnnotations(
    readOnlyHint=True,
    destructiveHint=False,
    idempotentHint=True,
    openWorldHint=False,
    costTier="light",
)

STANDARD = ToolAnnotations(
    readOnlyHint=True,
    destructiveHint=False,
    idempotentHint=True,
    openWorldHint=False,
    costTier="standard",
)

HEAVY = ToolAnnotations(
    readOnlyHint=False,
    destructiveHint=False,
    idempotentHint=False,
    openWorldHint=False,
    costTier="heavy",
)

DESTRUCTIVE = ToolAnnotations(
    readOnlyHint=False,
    destructiveHint=True,
    idempotentHint=False,
    openWorldHint=False,
    costTier="destructive",
)

# ---------------------------------------------------------------------------
# Convenience mapping for introspection / routing logic
# ---------------------------------------------------------------------------

TIER_MAP: dict[str, ToolAnnotations] = {
    "light": LIGHT,
    "standard": STANDARD,
    "heavy": HEAVY,
    "destructive": DESTRUCTIVE,
}

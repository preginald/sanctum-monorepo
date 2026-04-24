"""
Governance Rule Provider — derives controlled vocabularies from KB articles at runtime.

Implements SYS-002 Principle #4: "Derive rules from the KB, not from code."
Reads SYS-005 (Ticket Standards) and SYS-006 (Milestone Standards) to extract
allowed types, priorities, statuses, and transition maps.

Falls back to hardcoded defaults when KB articles are unreachable or unparseable
(SYS-002 Principle #5: "Fail gracefully").
"""
import logging
import re
import time
from sqlalchemy.orm import Session

from .. import models

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------
CACHE_TTL = 300  # seconds (5 minutes)

_cache: dict[str, tuple] = {}  # key -> (data, expires_at)


def _get_cached(key: str):
    entry = _cache.get(key)
    if entry and entry[1] > time.time():
        return entry[0]
    return None


def _set_cached(key: str, data):
    _cache[key] = (data, time.time() + CACHE_TTL)


def invalidate():
    """Clear the governance cache (useful for testing)."""
    _cache.clear()


# ---------------------------------------------------------------------------
# Article fetching
# ---------------------------------------------------------------------------
def _fetch_article_content(db: Session, identifier: str) -> str | None:
    """Fetch article content by identifier (e.g. 'SYS-005')."""
    article = db.query(models.Article).filter(
        models.Article.identifier == identifier.upper()
    ).first()
    if not article:
        return None
    return article.content


# ---------------------------------------------------------------------------
# Markdown table parser
# ---------------------------------------------------------------------------
def _parse_table_under_heading(content: str, heading: str) -> list[list[str]]:
    """Parse the first markdown table found under a given ### heading.

    Returns a list of rows, each row is a list of cell values (strings).
    The header row and separator row are excluded.
    """
    from .section_parser import get_section

    # Build the full heading string (e.g. "### Allowed Values")
    clean_heading = heading.lstrip("# ").strip()
    full_heading = f"### {clean_heading}"
    result = get_section(content, full_heading)
    if not result:
        return []

    section = result.body

    # Find table rows (lines starting with |)
    table_lines = [line.strip() for line in section.split("\n") if line.strip().startswith("|")]
    if len(table_lines) < 3:
        return []  # Need header + separator + at least one data row

    # Skip header (index 0) and separator (index 1)
    rows = []
    for line in table_lines[2:]:
        cells = [c.strip() for c in line.split("|")]
        # Remove empty first/last cells from leading/trailing |
        cells = [c for c in cells if c != ""]
        if cells:
            rows.append(cells)
    return rows


# ---------------------------------------------------------------------------
# Fallback defaults (current hardcoded values, used when KB is unavailable)
# ---------------------------------------------------------------------------
FALLBACK_TICKET_TYPES = [
    "support", "bug", "feature", "refactor", "task",
    "access", "maintenance", "alert", "hotfix", "test",
]

FALLBACK_PRIORITIES = ["low", "normal", "high", "critical"]

FALLBACK_TICKET_TRANSITIONS = {
    "new":            ["open", "recon", "implementation"],
    "recon":          ["proposal", "pending"],
    "proposal":       ["implementation", "recon", "pending"],
    "implementation": ["verification", "proposal", "pending"],
    "open":           ["pending", "resolved", "verification"],
    "verification":   ["review", "resolved", "implementation", "pending"],
    "review":         ["documented", "verification", "implementation", "pending"],
    "documented":     ["resolved", "review"],
    "pending":        ["open"],
    "resolved":       [],
}

# ---------------------------------------------------------------------------
# Per-type status flows (code-level constant — SYS-005 serves as documentation)
# ---------------------------------------------------------------------------
TICKET_STATUS_FLOWS = {
    # Templated types: full delivery pipeline
    "feature":  {"forward": ["new", "recon", "proposal", "implementation", "verification", "review", "documented", "resolved"],
                 "backward": {"proposal": ["recon"], "implementation": ["proposal"], "verification": ["implementation"], "review": ["verification", "implementation"], "documented": ["review"]}},
    "bug":      {"forward": ["new", "recon", "proposal", "implementation", "verification", "review", "documented", "resolved"],
                 "backward": {"proposal": ["recon"], "implementation": ["proposal"], "verification": ["implementation"], "review": ["verification", "implementation"], "documented": ["review"]}},
    "task":     {"forward": ["new", "recon", "proposal", "implementation", "verification", "review", "documented", "resolved"],
                 "backward": {"proposal": ["recon"], "implementation": ["proposal"], "verification": ["implementation"], "review": ["verification", "implementation"], "documented": ["review"]}},
    "refactor": {"forward": ["new", "recon", "proposal", "implementation", "verification", "review", "documented", "resolved"],
                 "backward": {"proposal": ["recon"], "implementation": ["proposal"], "verification": ["implementation"], "review": ["verification", "implementation"], "documented": ["review"]}},
    # Short-pipeline types
    "hotfix":      {"forward": ["new", "implementation", "verification", "resolved"],
                    "backward": {"verification": ["implementation"]}},
    "maintenance": {"forward": ["new", "implementation", "verification", "resolved"],
                    "backward": {"verification": ["implementation"]}},
    "test":        {"forward": ["new", "implementation", "verification", "resolved"],
                    "backward": {"verification": ["implementation"]}},
    # Simple types
    "support": {"forward": ["new", "open", "pending", "resolved"],
                "backward": {"pending": ["open"]}},
    "access":  {"forward": ["new", "open", "resolved"],
                "backward": {}},
    "alert":   {"forward": ["new", "open", "resolved"],
                "backward": {}},
}


def get_transitions_for_type(
    ticket_type: str,
    current_status: str,
    previous_status: str | None = None,
) -> list[str]:
    """Compute valid next statuses for a given ticket type and current status.

    Rules:
    1. Next forward status in the type's flow
    2. Backward transitions from the flow definition
    3. 'pending' as universal hold (unless already pending or resolved)
    4. When pending, resume to previous_status (or first-after-new default)
    5. 'new' as universal reopen target (from any non-new status)
    """
    flow = TICKET_STATUS_FLOWS.get(ticket_type)
    if not flow:
        # Unknown type — fall back to type-agnostic transitions
        transitions = list(FALLBACK_TICKET_TRANSITIONS.get(current_status, []))
        if current_status != "new":
            transitions.append("new")
        return transitions

    forward = flow["forward"]
    backward = flow["backward"]
    transitions: list[str] = []

    if current_status == "pending":
        # Resume from pending: go to previous_status or default
        if previous_status and previous_status in forward:
            transitions.append(previous_status)
        else:
            # Default to first status after 'new' in the flow
            if len(forward) > 1:
                transitions.append(forward[1])
        # If pending is part of the forward flow, also offer the next forward status
        if "pending" in forward:
            pend_idx = forward.index("pending")
            if pend_idx + 1 < len(forward):
                transitions.append(forward[pend_idx + 1])
    else:
        # Forward: next status in the flow
        if current_status in forward:
            idx = forward.index(current_status)
            if idx + 1 < len(forward):
                transitions.append(forward[idx + 1])

        # Backward transitions
        if current_status in backward:
            transitions.extend(backward[current_status])

        # Pending as universal hold (not from resolved, not if already pending)
        if current_status != "resolved":
            transitions.append("pending")

    # Universal reopen: any non-new status can go back to new
    if current_status != "new":
        transitions.append("new")

    # Deduplicate while preserving order
    seen = set()
    result = []
    for t in transitions:
        if t not in seen:
            seen.add(t)
            result.append(t)
    return result

FALLBACK_MILESTONE_STATUSES = ["pending", "active", "completed"]

FALLBACK_MILESTONE_TRANSITIONS = {
    "pending":   ["active"],
    "active":    ["completed"],
    "completed": ["active"],
}

FALLBACK_PROJECT_STATUSES = ["capture", "planning", "active", "completed", "on_hold"]

FALLBACK_PROJECT_TRANSITIONS = {
    "capture":    ["planning", "on_hold"],
    "planning":   ["active", "on_hold"],
    "active":     ["completed", "on_hold"],
    "completed":  ["active"],
    "on_hold":    ["planning", "active", "capture"],
}


# ---------------------------------------------------------------------------
# Typed accessors
# ---------------------------------------------------------------------------
def get_allowed_ticket_types(db: Session) -> list[str]:
    """Return allowed ticket types from SYS-005 '### Ticket Types' table."""
    cached = _get_cached("ticket_types")
    if cached is not None:
        return cached

    try:
        content = _fetch_article_content(db, "SYS-005")
        if not content:
            raise ValueError("SYS-005 not found")
        rows = _parse_table_under_heading(content, "Ticket Types")
        if not rows:
            raise ValueError("No Ticket Types table found in SYS-005")
        types = [row[0].strip("`").strip() for row in rows]
        if not types:
            raise ValueError("Empty Ticket Types table")
        _set_cached("ticket_types", types)
        return types
    except Exception as e:
        logger.warning("Governance fallback for ticket_types: %s", e)
        _set_cached("ticket_types", FALLBACK_TICKET_TYPES)
        return FALLBACK_TICKET_TYPES


def get_allowed_priorities(db: Session) -> list[str]:
    """Return allowed priorities from SYS-005 '### Priorities' table."""
    cached = _get_cached("priorities")
    if cached is not None:
        return cached

    try:
        content = _fetch_article_content(db, "SYS-005")
        if not content:
            raise ValueError("SYS-005 not found")
        rows = _parse_table_under_heading(content, "Priorities")
        if not rows:
            raise ValueError("No Priorities table found in SYS-005")
        priorities = [row[0].strip("`").strip() for row in rows]
        if not priorities:
            raise ValueError("Empty Priorities table")
        _set_cached("priorities", priorities)
        return priorities
    except Exception as e:
        logger.warning("Governance fallback for priorities: %s", e)
        _set_cached("priorities", FALLBACK_PRIORITIES)
        return FALLBACK_PRIORITIES


def get_ticket_transitions(db: Session) -> dict[str, list[str]]:
    """Return ticket status transition map from SYS-005 '### Statuses' table."""
    cached = _get_cached("ticket_transitions")
    if cached is not None:
        return cached

    try:
        content = _fetch_article_content(db, "SYS-005")
        if not content:
            raise ValueError("SYS-005 not found")
        rows = _parse_table_under_heading(content, "Statuses")
        if not rows:
            raise ValueError("No Statuses table found in SYS-005")

        # Build transition map from "Transition From" column (col 2)
        # First, collect all statuses
        transitions: dict[str, list[str]] = {}
        for row in rows:
            status = row[0].strip("`").strip()
            transitions[status] = []

        # Parse "Transition From" column to build reverse map
        for row in rows:
            status = row[0].strip("`").strip()
            if len(row) >= 3:
                from_col = row[2].strip()
                if from_col and from_col != "(initial)":
                    # Parse comma-separated source statuses, e.g. "new, open"
                    sources = [s.strip().strip("`") for s in from_col.split(",")]
                    for source in sources:
                        source = source.strip()
                        if source and source in transitions:
                            transitions[source].append(status)

        if not transitions:
            raise ValueError("Empty transition map")
        _set_cached("ticket_transitions", transitions)
        return transitions
    except Exception as e:
        logger.warning("Governance fallback for ticket_transitions: %s", e)
        _set_cached("ticket_transitions", FALLBACK_TICKET_TRANSITIONS)
        return FALLBACK_TICKET_TRANSITIONS


def get_allowed_milestone_statuses(db: Session) -> list[str]:
    """Return allowed milestone statuses from SYS-006 '### Statuses' table."""
    cached = _get_cached("milestone_statuses")
    if cached is not None:
        return cached

    try:
        content = _fetch_article_content(db, "SYS-006")
        if not content:
            raise ValueError("SYS-006 not found")
        rows = _parse_table_under_heading(content, "Statuses")
        if not rows:
            raise ValueError("No Statuses table found in SYS-006")
        statuses = [row[0].strip("`").strip() for row in rows]
        if not statuses:
            raise ValueError("Empty Statuses table")
        _set_cached("milestone_statuses", statuses)
        return statuses
    except Exception as e:
        logger.warning("Governance fallback for milestone_statuses: %s", e)
        _set_cached("milestone_statuses", FALLBACK_MILESTONE_STATUSES)
        return FALLBACK_MILESTONE_STATUSES


def get_milestone_transitions(db: Session) -> dict[str, list[str]]:
    """Return milestone status transition map from SYS-006 '### Statuses' table."""
    cached = _get_cached("milestone_transitions")
    if cached is not None:
        return cached

    try:
        content = _fetch_article_content(db, "SYS-006")
        if not content:
            raise ValueError("SYS-006 not found")
        rows = _parse_table_under_heading(content, "Statuses")
        if not rows:
            raise ValueError("No Statuses table found in SYS-006")

        transitions: dict[str, list[str]] = {}
        for row in rows:
            status = row[0].strip("`").strip()
            transitions[status] = []

        for row in rows:
            status = row[0].strip("`").strip()
            if len(row) >= 3:
                from_col = row[2].strip()
                if from_col and from_col != "(initial)":
                    sources = [s.strip().strip("`") for s in from_col.split(",")]
                    for source in sources:
                        source = source.strip()
                        if source and source in transitions:
                            transitions[source].append(status)

        if not transitions:
            raise ValueError("Empty transition map")
        _set_cached("milestone_transitions", transitions)
        return transitions
    except Exception as e:
        logger.warning("Governance fallback for milestone_transitions: %s", e)
        _set_cached("milestone_transitions", FALLBACK_MILESTONE_TRANSITIONS)
        return FALLBACK_MILESTONE_TRANSITIONS


def get_allowed_project_statuses(db: Session) -> list[str]:
    """Return allowed project statuses from SYS-030 '### Statuses' table."""
    cached = _get_cached("project_statuses")
    if cached is not None:
        return cached

    try:
        content = _fetch_article_content(db, "SYS-030")
        if not content:
            raise ValueError("SYS-030 not found")
        rows = _parse_table_under_heading(content, "Statuses")
        if not rows:
            raise ValueError("No Statuses table found in SYS-030")
        statuses = [row[0].strip("`").strip() for row in rows]
        if not statuses:
            raise ValueError("Empty Statuses table")
        _set_cached("project_statuses", statuses)
        return statuses
    except Exception as e:
        logger.warning("Governance fallback for project_statuses: %s", e)
        _set_cached("project_statuses", FALLBACK_PROJECT_STATUSES)
        return FALLBACK_PROJECT_STATUSES


def get_project_transitions(db: Session) -> dict[str, list[str]]:
    """Return project status transition map from SYS-030 '### Statuses' table."""
    cached = _get_cached("project_transitions")
    if cached is not None:
        return cached

    try:
        content = _fetch_article_content(db, "SYS-030")
        if not content:
            raise ValueError("SYS-030 not found")
        rows = _parse_table_under_heading(content, "Statuses")
        if not rows:
            raise ValueError("No Statuses table found in SYS-030")

        transitions: dict[str, list[str]] = {}
        for row in rows:
            status = row[0].strip("`").strip()
            transitions[status] = []

        for row in rows:
            status = row[0].strip("`").strip()
            if len(row) >= 3:
                from_col = row[2].strip()
                if from_col and from_col != "(initial)":
                    sources = [s.strip().strip("`") for s in from_col.split(",")]
                    for source in sources:
                        source = source.strip()
                        if source and source in transitions:
                            transitions[source].append(status)

        if not transitions:
            raise ValueError("Empty transition map")
        _set_cached("project_transitions", transitions)
        return transitions
    except Exception as e:
        logger.warning("Governance fallback for project_transitions: %s", e)
        _set_cached("project_transitions", FALLBACK_PROJECT_TRANSITIONS)
        return FALLBACK_PROJECT_TRANSITIONS

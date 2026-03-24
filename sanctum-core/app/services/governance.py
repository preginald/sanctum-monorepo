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
    "new":      ["open", "pending"],
    "open":     ["qa", "resolved", "pending"],
    "pending":  ["open", "resolved"],
    "qa":       ["resolved"],
    "resolved": ["closed"],
    "closed":   [],
}

FALLBACK_MILESTONE_STATUSES = ["pending", "active", "completed"]

FALLBACK_MILESTONE_TRANSITIONS = {
    "pending":   ["active"],
    "active":    ["completed"],
    "completed": ["active"],
}

FALLBACK_PROJECT_STATUSES = ["planning", "active", "completed", "on_hold"]

FALLBACK_PROJECT_TRANSITIONS = {
    "planning":   ["active", "on_hold"],
    "active":     ["completed", "on_hold"],
    "completed":  ["active"],
    "on_hold":    ["planning", "active"],
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

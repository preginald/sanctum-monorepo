"""
API Expand Contract (SYS-032) — response field expansion service.

Controls which nested fields are included in API responses. By default,
service accounts get lean responses (counts only) and human users get
full responses (all nested data). Any consumer can override via ?expand=...
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from fastapi import Depends, Query, Request

from ..auth import get_current_active_user
from .. import models


# Expandable fields per entity type (SYS-032 contract)
EXPANDABLE_FIELDS: dict[str, set[str]] = {
    "project": {"milestones", "artefacts"},
    "article": {"history", "related_articles", "artefacts"},
    "milestone": {"ticket_descriptions", "health_check"},
    "ticket": {
        "comments", "articles", "artefacts",
        "time_entries", "materials", "related_tickets",
    },
}


@dataclass
class ExpandConfig:
    """Parsed expand configuration for the current request."""

    fields: set[str] = field(default_factory=set)
    expand_all: bool = False
    consumer_type: str = "human"  # "human", "service", "api"
    raw_param: Optional[str] = None

    def should_expand(self, field_name: str) -> bool:
        """Return True if the given field should be included in the response."""
        if self.expand_all:
            return True
        return field_name in self.fields


def _detect_consumer_type(user: models.User) -> str:
    """Determine consumer type from authenticated user."""
    if user.user_type == "service":
        return "service"
    return "human"


def _default_expand_all(consumer_type: str) -> bool:
    """Human users get expand=all by default; service/api get expand=none."""
    return consumer_type == "human"


def get_expand_config(
    expand: Optional[str] = Query(
        None,
        description=(
            "Comma-separated fields to expand, 'all' for everything, "
            "'none' for lean response. Omit for consumer-aware default."
        ),
    ),
    current_user: models.User = Depends(get_current_active_user),
) -> ExpandConfig:
    """FastAPI dependency that parses the ?expand= query parameter."""
    consumer_type = _detect_consumer_type(current_user)

    if expand is None:
        # Consumer-aware default
        return ExpandConfig(
            expand_all=_default_expand_all(consumer_type),
            consumer_type=consumer_type,
            raw_param=None,
        )

    raw = expand.strip().lower()

    if raw == "all":
        return ExpandConfig(
            expand_all=True,
            consumer_type=consumer_type,
            raw_param=expand,
        )

    if raw == "none" or raw == "":
        return ExpandConfig(
            fields=set(),
            expand_all=False,
            consumer_type=consumer_type,
            raw_param=expand,
        )

    # Comma-separated field names
    fields = {f.strip() for f in raw.split(",") if f.strip()}
    return ExpandConfig(
        fields=fields,
        expand_all=False,
        consumer_type=consumer_type,
        raw_param=expand,
    )


def filter_response(
    data: dict,
    expand: ExpandConfig,
    entity_type: str,
) -> dict:
    """Strip unexpanded list fields and replace with counts.

    Operates on a dict (not an ORM object) so it runs after serialisation.
    Unknown expand fields are silently ignored (forward compatibility).
    """
    expandable = EXPANDABLE_FIELDS.get(entity_type, set())

    for field_name in expandable:
        if expand.should_expand(field_name):
            continue

        # Special case: ticket_descriptions strips the description from
        # nested ticket objects rather than removing the tickets list.
        if field_name == "ticket_descriptions":
            tickets = data.get("tickets")
            if isinstance(tickets, list):
                for t in tickets:
                    if isinstance(t, dict):
                        t.pop("description", None)
            continue

        # Special case: health_check is a single object, not a list
        if field_name == "health_check":
            data.pop("health_check", None)
            continue

        # Standard case: replace list with count
        if field_name in data and isinstance(data[field_name], list):
            data[f"{field_name}_count"] = len(data[field_name])
            del data[field_name]

    return data

"""Ticket status constants — canonical lifecycle vocabulary.

Single source of truth for valid ticket status values. The DB column remains
``String`` (not a PG ENUM) so adding new statuses is additive and reversible;
this ``StrEnum`` provides O(1) validation and ergonomic member access for
Python call sites.

Design ratified in #2873 (resolution comment
``60ad48bb-3318-4587-9d5b-ab8b196aa24c``) and implemented in #2875.

``CLOSED`` is retained for read-tolerance until the deprecation window closes
in #3028 (due 2026-10-31). No new writes should use ``CLOSED``.
"""
from enum import StrEnum


class TicketStatus(StrEnum):
    """Canonical ticket status values.

    Order reflects the templated-delivery pipeline (``feature``, ``bug``,
    ``task``, ``refactor``):

        new -> recon -> proposal -> implementation -> verification ->
        review -> documented -> resolved

    Simple/short-pipeline types use a subset (``open``, ``pending``,
    ``resolved``).
    """

    NEW = "new"
    OPEN = "open"
    RECON = "recon"
    PROPOSAL = "proposal"
    IMPLEMENTATION = "implementation"
    VERIFICATION = "verification"
    REVIEW = "review"
    DOCUMENTED = "documented"
    PENDING = "pending"
    RESOLVED = "resolved"
    # LEGACY — retained for read-tolerance until #3028 (2026-10-31)
    CLOSED = "closed"


# Frozen set of valid status values for O(1) membership checks.
TICKET_STATUS_VALUES: frozenset[str] = frozenset(s.value for s in TicketStatus)

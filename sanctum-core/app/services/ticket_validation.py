"""
Ticket validation — enforces template conformity and status lifecycle.

Description validation: required section headings per ticket type (DOC-013–016).
Status transitions: derived from SYS-005 at runtime via governance provider.
Type/priority validation: derived from SYS-005 controlled vocabularies.
See SYS-002 for the enforcement philosophy.
"""
import logging
import re
from fastapi import HTTPException
from sqlalchemy.orm import Session

from .governance import get_ticket_transitions, get_allowed_ticket_types, get_allowed_priorities

logger = logging.getLogger(__name__)


def get_available_transitions(status: str, db: Session) -> list[str]:
    """Return allowed target statuses. Any status can transition to 'new' (reopen)."""
    transitions_map = get_ticket_transitions(db)
    transitions = list(transitions_map.get(status, []))
    if status != "new":
        transitions.append("new")
    return transitions


def validate_ticket_transition(current: str, requested: str, db: Session) -> None:
    """Validate a status transition. Raises HTTPException(422) if invalid."""
    if requested == "new":
        return  # Reopening is always allowed
    transitions_map = get_ticket_transitions(db)
    allowed = transitions_map.get(current, [])
    if requested not in allowed:
        raise HTTPException(
            status_code=422,
            detail={
                "detail": f"Invalid status transition: {current} → {requested}",
                "current": current,
                "requested": requested,
                "allowed": get_available_transitions(current, db),
                "reference": "SYS-005",
                "help": "See SYS-005 for the ticket status lifecycle.",
            },
        )


def validate_ticket_type(ticket_type: str, db: Session) -> None:
    """Validate ticket type against SYS-005 controlled vocabulary."""
    allowed = get_allowed_ticket_types(db)
    if ticket_type not in allowed:
        raise HTTPException(
            status_code=422,
            detail={
                "detail": f"Invalid ticket type: '{ticket_type}'",
                "allowed": allowed,
                "reference": "SYS-005",
                "help": "See SYS-005 Controlled Vocabularies > Ticket Types.",
            },
        )


def validate_ticket_priority(priority: str, db: Session) -> None:
    """Validate priority against SYS-005 controlled vocabulary."""
    allowed = get_allowed_priorities(db)
    if priority not in allowed:
        raise HTTPException(
            status_code=422,
            detail={
                "detail": f"Invalid priority: '{priority}'",
                "allowed": allowed,
                "reference": "SYS-005",
                "help": "See SYS-005 Controlled Vocabularies > Priorities.",
            },
        )


# ticket_type → required headings + template article identifier
TEMPLATE_REQUIREMENTS = {
    "feature": {
        "headings": ["## Objective", "## Requirements", "## Acceptance Criteria"],
        "article": "DOC-016",
    },
    "bug": {
        "headings": ["## Bug", "## Root Cause", "## Acceptance Criteria"],
        "article": "DOC-013",
    },
    "task": {
        "headings": ["## Objective", "## Requirements", "## Acceptance Criteria"],
        "article": "DOC-014",
    },
    "refactor": {
        "headings": ["## Objective", "## Motivation", "## Acceptance Criteria"],
        "article": "DOC-015",
    },
}

EXEMPT_TYPES = {"support", "access", "maintenance", "alert", "hotfix", "test"}

# Fields that indicate substantive work (trigger auto-transition from 'new')
SUBSTANTIVE_FIELDS = {"description", "priority", "milestone_id", "assigned_tech_id"}


def auto_transition_from_new(ticket, db: Session) -> bool:
    """Auto-transition a ticket from 'new' to 'open' if it is currently 'new'.

    Returns True if the transition was applied.
    """
    if ticket.status != "new":
        return False
    ticket.status = "open"
    db.flush()
    logger.info("Auto-transitioned ticket #%s from new → open", ticket.id)
    return True


def validate_ticket_description(ticket_type: str, description: str | None) -> None:
    """Validate description against the template for the given ticket type.

    Returns None if valid. Raises HTTPException(422) with structured error if not.
    Skips validation for exempt types or when description is None/empty.
    """
    if not description:
        return

    if ticket_type in EXEMPT_TYPES:
        return

    requirements = TEMPLATE_REQUIREMENTS.get(ticket_type)
    if not requirements:
        return

    # Extract all ## headings from the description
    found_headings = set(re.findall(r"^## .+", description, re.MULTILINE))

    missing = [h for h in requirements["headings"] if h not in found_headings]

    if not missing:
        return

    article = requirements["article"]
    raise HTTPException(
        status_code=422,
        detail={
            "detail": f"Ticket description does not conform to the {ticket_type} template ({article})",
            "missing_sections": missing,
            "template_article": article,
            "help": f"See {article} for the required template. Include skip_validation: true to bypass.",
        },
    )

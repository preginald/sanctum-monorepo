"""
Ticket validation — enforces template conformity and status lifecycle.

Description validation: required section headings per ticket type (DOC-013–016, DOC-057–062).
Status transitions: derived from SYS-005 at runtime via governance provider.
Type/priority validation: derived from SYS-005 controlled vocabularies.
See SYS-002 for the enforcement philosophy.
"""
import logging
import re
from fastapi import HTTPException
from sqlalchemy.orm import Session

from .governance import get_ticket_transitions, get_allowed_ticket_types, get_allowed_priorities, get_transitions_for_type

logger = logging.getLogger(__name__)


def get_available_transitions(
    status: str,
    db: Session,
    ticket_type: str | None = None,
    previous_status: str | None = None,
) -> list[str]:
    """Return allowed target statuses.

    When ticket_type is provided, uses per-type flow definitions.
    Falls back to type-agnostic transitions when ticket_type is None.
    """
    if ticket_type:
        return get_transitions_for_type(ticket_type, status, previous_status)
    # Legacy fallback: type-agnostic
    transitions_map = get_ticket_transitions(db)
    transitions = list(transitions_map.get(status, []))
    if status != "new":
        transitions.append("new")
    return transitions


def validate_ticket_transition(
    current: str,
    requested: str,
    db: Session,
    ticket_type: str | None = None,
    previous_status: str | None = None,
    phase_criteria: dict | None = None,
) -> None:
    """Validate a status transition. Raises HTTPException(422) if invalid.

    When ticket_type is provided, validates against per-type flow definitions.

    Governor Gate 2 (#2876): when ``phase_criteria`` is supplied and contains an
    entry for the ``current`` status with any falsy values, the forward
    transition is rejected. Reopening (``requested == "new"``) and tickets with
    empty/missing phase_criteria bypass the check. The caller is expected to
    gate this under the existing ``skip_validation`` flag for the break-glass
    override path.
    """
    if requested == "new":
        return  # Reopening is always allowed

    # Governor Gate 2 — phase_criteria enforcement for forward transitions
    if phase_criteria and current in phase_criteria:
        criteria = phase_criteria.get(current)
        # Support both the flat `{key: bool}` and nested `{"items": [...]}`
        # shapes. A dict with an `items` list is treated as ticked iff every
        # item's `done` (or `checked`) flag is truthy; otherwise every value
        # in the dict must be truthy.
        unticked: list[str] = []
        if isinstance(criteria, dict):
            if isinstance(criteria.get("items"), list):
                for idx, item in enumerate(criteria["items"]):
                    if isinstance(item, dict):
                        done = item.get("done", item.get("checked", False))
                        if not done:
                            unticked.append(str(item.get("key", item.get("label", f"item_{idx}"))))
                    elif not item:
                        unticked.append(f"item_{idx}")
            else:
                unticked = [str(k) for k, v in criteria.items() if not v]
        if unticked:
            raise HTTPException(
                status_code=422,
                detail={
                    "detail": f"Cannot leave '{current}' — phase criteria incomplete.",
                    "error_code": "GOVERNOR_GATE_PHASE_CRITERIA",
                    "current": current,
                    "requested": requested,
                    "phase": current,
                    "missing_criteria": unticked,
                    "next_action": f"Tick all items in phase_criteria['{current}'] via ticket_update before transitioning.",
                    "reference": "SYS-005",
                    "help": "See SYS-005 for the ticket status lifecycle and phase criteria model.",
                },
            )

    allowed = get_available_transitions(current, db, ticket_type=ticket_type, previous_status=previous_status)
    if requested not in allowed:
        type_label = f" {ticket_type}" if ticket_type else ""
        raise HTTPException(
            status_code=422,
            detail={
                "detail": f"Cannot transition{type_label} ticket from '{current}' to '{requested}'. Valid transitions: {allowed}",
                "current": current,
                "requested": requested,
                "allowed": allowed,
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
    "hotfix": {
        "headings": ["## Bug", "## Fix", "## Acceptance Criteria"],
        "article": "DOC-057",
    },
    "support": {
        "headings": ["## Issue", "## Investigation", "## Response", "## Acceptance Criteria"],
        "article": "DOC-058",
    },
    "alert": {
        "headings": ["## Alert", "## Triage", "## Action", "## Acceptance Criteria"],
        "article": "DOC-059",
    },
    "access": {
        "headings": ["## Request", "## Justification", "## Acceptance Criteria"],
        "article": "DOC-060",
    },
    "maintenance": {
        "headings": ["## Objective", "## Procedure", "## Rollback", "## Acceptance Criteria"],
        "article": "DOC-061",
    },
    "test": {
        "headings": ["## Objective", "## Test Plan", "## Expected Results", "## Acceptance Criteria"],
        "article": "DOC-062",
    },
}

# Fields that indicate substantive work (trigger auto-transition from 'new')
SUBSTANTIVE_FIELDS = {"description", "priority", "milestone_id", "assigned_tech_id"}


# Type categories for auto-transition target from 'new'
_TEMPLATED_TYPES = {"feature", "bug", "task", "refactor"}
_SHORT_PIPELINE_TYPES = {"hotfix", "maintenance", "test"}
_SIMPLE_TYPES = {"support", "access", "alert"}


def auto_transition_from_new(ticket, db: Session) -> tuple[bool, str | None, str | None]:
    """Auto-transition a ticket from 'new' based on its type.

    Templated types (feature/bug/task/refactor): new -> recon
    Short-pipeline types (hotfix/maintenance/test): new -> implementation
    Simple types (support/access/alert): new -> open

    Returns (applied, from_status, to_status).
    """
    if ticket.status != "new":
        return False, None, None
    ticket_type = getattr(ticket, "ticket_type", "support") or "support"
    if ticket_type in _TEMPLATED_TYPES:
        target = "recon"
    elif ticket_type in _SHORT_PIPELINE_TYPES:
        target = "implementation"
    else:
        target = "open"
    ticket.status = target
    db.flush()
    logger.info("Auto-transitioned ticket #%s from new -> %s (type=%s)", ticket.id, target, ticket_type)
    return True, "new", target


def validate_ticket_description(ticket_type: str, description: str | None) -> None:
    """Validate description against the template for the given ticket type.

    Returns None if valid. Raises HTTPException(422) with structured error if not.
    Skips validation when description is None/empty or ticket type has no template.
    """
    if not description:
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

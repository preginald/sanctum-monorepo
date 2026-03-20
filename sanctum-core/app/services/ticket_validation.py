"""
Ticket description validation — enforces template conformity by ticket type.

Validates that required section headings are present in the description markdown.
See SYS-002 for the enforcement philosophy and DOC-013–016 for templates.
"""
import re
from fastapi import HTTPException


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

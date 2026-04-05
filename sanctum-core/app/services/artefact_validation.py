"""
Artefact validation — enforces authorship rules for restricted categories.

session_handover artefacts must be authored by the orchestrating agent with
active session context, not by service accounts like The Scribe.
See SOP-038 for the session handover standard.
"""
from uuid import UUID

from fastapi import HTTPException

# The Scribe — documentation service account (not an orchestrating agent)
SCRIBE_USER_ID = "a1b2c3d4-0006-4000-8000-000000000006"


def validate_session_handover_authorship(
    category: str | None,
    created_by_id: UUID,
) -> None:
    """Block session_handover artefacts from restricted service accounts.

    Raises HTTPException(422) if a restricted account attempts to create
    a session_handover artefact.  All other categories pass unconditionally.
    """
    if category is None or category != "session_handover":
        return

    if str(created_by_id) == SCRIBE_USER_ID:
        raise HTTPException(
            status_code=422,
            detail={
                "detail": "session_handover artefacts cannot be created by The Scribe. Session handovers must be authored by the agent with active session context.",
                "error_code": "handover_authorship_restricted",
                "category": "session_handover",
                "blocked_account": str(created_by_id),
                "reference": "SOP-038",
                "help": "See SOP-038 for the session handover standard. Only orchestrating agents and human operators may author session handovers.",
            },
        )

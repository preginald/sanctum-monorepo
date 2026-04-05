"""
Milestone sequence management — insert-and-shift semantics.

When a milestone is created or moved to a sequence position that is already
occupied within the same project, existing milestones at that position and
above are shifted up by one.  All operations run within the caller's
SQLAlchemy session so they commit atomically with the create/update.

Reference: ticket #1529.
"""
from sqlalchemy.orm import Session
from .. import models


def shift_sequences_for_insert(project_id: str, target_sequence: int, db: Session) -> None:
    """Shift existing milestones at *target_sequence* or above up by one.

    Called before inserting a new milestone so the new row can occupy
    *target_sequence* without a collision.  If no milestone occupies the
    target position the query matches zero rows and this is a no-op.

    Milestones are updated from highest sequence downward to avoid
    transient duplicates within the session.
    """
    milestones = (
        db.query(models.Milestone)
        .filter(
            models.Milestone.project_id == project_id,
            models.Milestone.sequence >= target_sequence,
        )
        .order_by(models.Milestone.sequence.desc())
        .all()
    )
    for ms in milestones:
        ms.sequence += 1
    db.flush()


def shift_sequences_for_move(
    project_id: str,
    milestone_id,
    old_sequence: int,
    new_sequence: int,
    db: Session,
) -> None:
    """Re-sequence surrounding milestones when an existing milestone moves.

    Moving *up* (new < old): milestones in [new, old) shift down (+1).
    Moving *down* (new > old): milestones in (old, new] shift up (-1).
    The milestone being moved is excluded from the shift — the caller
    sets its sequence directly after this function returns.
    """
    if new_sequence == old_sequence:
        return

    if new_sequence < old_sequence:
        # Moving up — push others down
        milestones = (
            db.query(models.Milestone)
            .filter(
                models.Milestone.project_id == project_id,
                models.Milestone.id != milestone_id,
                models.Milestone.sequence >= new_sequence,
                models.Milestone.sequence < old_sequence,
            )
            .order_by(models.Milestone.sequence.desc())
            .all()
        )
        for ms in milestones:
            ms.sequence += 1
    else:
        # Moving down — pull others up
        milestones = (
            db.query(models.Milestone)
            .filter(
                models.Milestone.project_id == project_id,
                models.Milestone.id != milestone_id,
                models.Milestone.sequence > old_sequence,
                models.Milestone.sequence <= new_sequence,
            )
            .order_by(models.Milestone.sequence.asc())
            .all()
        )
        for ms in milestones:
            ms.sequence -= 1
    db.flush()

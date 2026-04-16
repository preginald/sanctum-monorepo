"""Workbench router — per-operator project pinning (#1917)."""

from datetime import datetime, timezone, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import func as sa_func, case
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/workbench", tags=["Workbench"])

MAX_PINS = 5


def _resolve_workbench_user(current_user: models.User, db: Session) -> models.User:
    """Service accounts resolve to their account's primary human admin user.

    This ensures MCP-originated pins appear on the operator's workbench,
    not the service account's.
    """
    if current_user.user_type == "service_account" and current_user.account_id:
        # Try admin first, fall back to any active human user in the account
        owner = db.query(models.User).filter(
            models.User.account_id == current_user.account_id,
            models.User.user_type == "human",
            models.User.is_active == True,
        ).order_by(
            # Prefer admin role, then by earliest created
            (models.User.role != "admin"),
            models.User.id,
        ).first()
        if owner:
            return owner
    return current_user


@router.get("", response_model=schemas.WorkbenchListResponse)
def list_pins(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """List pinned projects for the current user with ticket summaries."""
    target_user = _resolve_workbench_user(current_user, db)
    pins = (
        db.query(models.WorkbenchPin)
        .filter(models.WorkbenchPin.user_id == target_user.id)
        .order_by(models.WorkbenchPin.position, models.WorkbenchPin.pinned_at)
        .all()
    )

    result = []
    for pin in pins:
        project = db.query(models.Project).filter(
            models.Project.id == pin.project_id,
            models.Project.is_deleted == False,
        ).first()
        if not project:
            continue

        # Ticket summary via aggregation (tickets link to projects through milestones)
        project_milestone_ids = [
            m.id for m in db.query(models.Milestone.id).filter(
                models.Milestone.project_id == pin.project_id
            ).all()
        ]
        if project_milestone_ids:
            ticket_stats = (
                db.query(
                    sa_func.count(models.Ticket.id).label("total"),
                    sa_func.sum(
                        case((models.Ticket.status != "resolved", 1), else_=0)
                    ).label("open"),
                    sa_func.sum(
                        case((models.Ticket.status == "resolved", 1), else_=0)
                    ).label("resolved"),
                )
                .filter(
                    models.Ticket.milestone_id.in_(project_milestone_ids),
                    models.Ticket.is_deleted == False,
                )
                .first()
            )
        else:
            ticket_stats = None

        account = db.query(models.Account).filter(models.Account.id == project.account_id).first()

        result.append(
            schemas.WorkbenchPinResponse(
                id=pin.id,
                user_id=pin.user_id,
                project_id=pin.project_id,
                project_name=project.name,
                project_status=project.status,
                account_name=account.name if account else None,
                position=pin.position,
                pinned_at=pin.pinned_at,
                ticket_summary=schemas.TicketSummary(
                    total=(ticket_stats.total or 0) if ticket_stats else 0,
                    open=(ticket_stats.open or 0) if ticket_stats else 0,
                    resolved=(ticket_stats.resolved or 0) if ticket_stats else 0,
                ),
            )
        )

    return schemas.WorkbenchListResponse(pins=result, max_pins=MAX_PINS)


@router.post("/pin")
def pin_project(
    payload: schemas.WorkbenchPinCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Pin a project to the workbench. Upsert: 201 new, 200 updated."""
    target_user = _resolve_workbench_user(current_user, db)

    # Verify project exists
    project = db.query(models.Project).filter(
        models.Project.id == payload.project_id,
        models.Project.is_deleted == False,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check if already pinned (for 201 vs 200 distinction)
    existing = (
        db.query(models.WorkbenchPin)
        .filter(
            models.WorkbenchPin.user_id == target_user.id,
            models.WorkbenchPin.project_id == payload.project_id,
        )
        .first()
    )

    # Enforce max pins (only for new pins)
    if not existing:
        pin_count = (
            db.query(sa_func.count(models.WorkbenchPin.id))
            .filter(models.WorkbenchPin.user_id == target_user.id)
            .scalar()
        )
        if pin_count >= MAX_PINS:
            raise HTTPException(
                status_code=422,
                detail=f"Maximum {MAX_PINS} pins allowed. Unpin a project first.",
            )

    # Upsert via PostgreSQL INSERT ... ON CONFLICT
    stmt = pg_insert(models.WorkbenchPin.__table__).values(
        user_id=target_user.id,
        project_id=payload.project_id,
        position=payload.position if payload.position is not None else 0,
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_workbench_pins_user_project",
        set_={
            "position": stmt.excluded.position,
            "pinned_at": sa_func.now(),
        },
    )
    db.execute(stmt)
    db.commit()

    # Fetch the pin to return
    pin = (
        db.query(models.WorkbenchPin)
        .filter(
            models.WorkbenchPin.user_id == target_user.id,
            models.WorkbenchPin.project_id == payload.project_id,
        )
        .first()
    )

    status_code = 200 if existing else 201
    return JSONResponse(
        status_code=status_code,
        content={
            "id": str(pin.id),
            "user_id": str(pin.user_id),
            "project_id": str(pin.project_id),
            "position": pin.position,
            "pinned_at": pin.pinned_at.isoformat(),
        },
    )


@router.delete("/pin/{project_id}")
def unpin_project(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Remove a project pin."""
    target_user = _resolve_workbench_user(current_user, db)
    pin = (
        db.query(models.WorkbenchPin)
        .filter(
            models.WorkbenchPin.user_id == target_user.id,
            models.WorkbenchPin.project_id == project_id,
        )
        .first()
    )
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")

    db.delete(pin)
    db.commit()
    return {"status": "unpinned", "project_id": str(project_id)}


@router.patch("/reorder")
def reorder_pins(
    payload: schemas.WorkbenchReorderRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Bulk update pin positions."""
    target_user = _resolve_workbench_user(current_user, db)
    for item in payload.pin_order:
        db.query(models.WorkbenchPin).filter(
            models.WorkbenchPin.user_id == target_user.id,
            models.WorkbenchPin.project_id == item.project_id,
        ).update({"position": item.position})
    db.commit()
    return {"status": "reordered", "count": len(payload.pin_order)}


# --- Workbench Summary ---

RESOLVED_STATUSES = {"resolved"}
PENDING_STATUSES = {"pending"}


def _compute_health(tickets, last_activity_at, milestones):
    """Compute health colour and tooltip per design spec."""
    now = datetime.now(timezone.utc)

    has_pending = any(t.status in PENDING_STATUSES for t in tickets)
    overdue_milestones = [
        m for m in milestones
        if m.due_date and m.status != "completed"
        and datetime.combine(m.due_date, datetime.min.time()).replace(tzinfo=timezone.utc) < now
    ]

    if last_activity_at:
        days_stale = (now - last_activity_at).days
    else:
        days_stale = 999

    # Red: 7+ days stale or milestone overdue
    if days_stale >= 7:
        return schemas.workbench.SummaryHealth(
            colour="red",
            tooltip=f"No activity for {days_stale} days",
        )
    if overdue_milestones:
        names = ", ".join(m.name for m in overdue_milestones[:2])
        return schemas.workbench.SummaryHealth(
            colour="red",
            tooltip=f"Milestone overdue: {names}",
        )

    # Amber: pending tickets or 3-7 days stale
    if has_pending:
        pending_count = sum(1 for t in tickets if t.status in PENDING_STATUSES)
        return schemas.workbench.SummaryHealth(
            colour="amber",
            tooltip=f"{pending_count} ticket{'s' if pending_count != 1 else ''} in pending status — needs attention",
        )
    if days_stale >= 3:
        return schemas.workbench.SummaryHealth(
            colour="amber",
            tooltip=f"No activity for {days_stale} days",
        )

    # Green
    return schemas.workbench.SummaryHealth(colour="green", tooltip="On track")


@router.get("/{project_id}/summary", response_model=schemas.WorkbenchSummaryResponse)
def get_workbench_summary(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Lightweight workbench summary for a single pinned project."""
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.is_deleted == False,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    account = db.query(models.Account).filter(
        models.Account.id == project.account_id
    ).first()

    # Fetch milestones ordered by sequence
    milestones = (
        db.query(models.Milestone)
        .filter(
            models.Milestone.project_id == project_id,
            models.Milestone.is_deleted == False,
        )
        .order_by(models.Milestone.sequence)
        .all()
    )
    milestone_ids = [m.id for m in milestones]

    # Fetch all tickets across milestones
    tickets = []
    if milestone_ids:
        tickets = (
            db.query(models.Ticket)
            .filter(
                models.Ticket.milestone_id.in_(milestone_ids),
                models.Ticket.is_deleted == False,
            )
            .all()
        )

    # Progress
    total = len(tickets)
    resolved = sum(1 for t in tickets if t.status in RESOLVED_STATUSES)

    # Active milestone: first non-completed milestone
    active_milestone = None
    for m in milestones:
        if m.status in ("active", "pending"):
            active_milestone = m
            break

    # Current ticket: first non-resolved ticket in active milestone by sequence
    # If no open tickets in active milestone, check subsequent milestones
    current_ticket = None
    next_ticket = None

    # Build ordered list of open tickets across milestones (by milestone sequence, then ticket id)
    open_tickets_ordered = []
    milestone_map = {m.id: m.sequence for m in milestones}
    for t in tickets:
        if t.status not in RESOLVED_STATUSES:
            ms_seq = milestone_map.get(t.milestone_id, 999)
            open_tickets_ordered.append((ms_seq, t.id, t))
    open_tickets_ordered.sort(key=lambda x: (x[0], x[1]))

    if open_tickets_ordered:
        current_ticket = open_tickets_ordered[0][2]
        if len(open_tickets_ordered) > 1:
            next_ticket = open_tickets_ordered[1][2]

    # Last activity: most recent updated_at or created_at across tickets
    last_activity_at = None
    for t in tickets:
        ts = t.updated_at or t.created_at
        if ts and (last_activity_at is None or ts > last_activity_at):
            last_activity_at = ts

    health = _compute_health(tickets, last_activity_at, milestones)

    return schemas.WorkbenchSummaryResponse(
        project_id=project.id,
        project_name=project.name,
        status=project.status,
        account_name=account.name if account else None,
        active_milestone=schemas.workbench.SummaryMilestone(
            id=active_milestone.id,
            name=active_milestone.name,
            status=active_milestone.status,
        ) if active_milestone else None,
        current_ticket=schemas.workbench.SummaryTicket(
            id=current_ticket.id,
            subject=current_ticket.subject,
            status=current_ticket.status,
        ) if current_ticket else None,
        next_ticket=schemas.workbench.SummaryTicket(
            id=next_ticket.id,
            subject=next_ticket.subject,
            status=next_ticket.status,
        ) if next_ticket else None,
        progress=schemas.workbench.SummaryProgress(
            resolved=resolved,
            total=total,
        ),
        health=health,
        last_activity_at=last_activity_at,
    )

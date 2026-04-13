"""Workbench router — per-operator project pinning (#1917)."""

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


@router.get("", response_model=schemas.WorkbenchListResponse)
def list_pins(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """List pinned projects for the current user with ticket summaries."""
    pins = (
        db.query(models.WorkbenchPin)
        .filter(models.WorkbenchPin.user_id == current_user.id)
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

        # Ticket summary via aggregation
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
                models.Ticket.project_id == pin.project_id,
                models.Ticket.is_deleted == False,
            )
            .first()
        )

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
                    total=ticket_stats.total or 0,
                    open=ticket_stats.open or 0,
                    resolved=ticket_stats.resolved or 0,
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
            models.WorkbenchPin.user_id == current_user.id,
            models.WorkbenchPin.project_id == payload.project_id,
        )
        .first()
    )

    # Enforce max pins (only for new pins)
    if not existing:
        pin_count = (
            db.query(sa_func.count(models.WorkbenchPin.id))
            .filter(models.WorkbenchPin.user_id == current_user.id)
            .scalar()
        )
        if pin_count >= MAX_PINS:
            raise HTTPException(
                status_code=422,
                detail=f"Maximum {MAX_PINS} pins allowed. Unpin a project first.",
            )

    # Upsert via PostgreSQL INSERT ... ON CONFLICT
    stmt = pg_insert(models.WorkbenchPin.__table__).values(
        user_id=current_user.id,
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
            models.WorkbenchPin.user_id == current_user.id,
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
    pin = (
        db.query(models.WorkbenchPin)
        .filter(
            models.WorkbenchPin.user_id == current_user.id,
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
    for item in payload.pin_order:
        db.query(models.WorkbenchPin).filter(
            models.WorkbenchPin.user_id == current_user.id,
            models.WorkbenchPin.project_id == item.project_id,
        ).update({"position": item.position})
    db.commit()
    return {"status": "reordered", "count": len(payload.pin_order)}

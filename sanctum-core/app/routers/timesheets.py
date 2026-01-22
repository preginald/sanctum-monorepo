from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, date
from typing import List
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/timesheets", tags=["Timesheets"])

@router.get("/my-week")
def get_my_week(
    offset: int = 0, # 0 = this week, -1 = last week
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    # 1. Calculate Date Range (Mon-Sun)
    today = date.today()
    start_of_week = today - timedelta(days=today.weekday()) + timedelta(weeks=offset)
    end_of_week = start_of_week + timedelta(days=6)
    
    # 2. Fetch Entries
    entries = db.query(models.TicketTimeEntry).filter(
        models.TicketTimeEntry.user_id == current_user.id,
        func.date(models.TicketTimeEntry.start_time) >= start_of_week,
        func.date(models.TicketTimeEntry.start_time) <= end_of_week
    ).all()
    
    # 3. Aggregate by Day
    grid = {i: {"date": (start_of_week + timedelta(days=i)).isoformat(), "hours": 0.0, "entries": []} for i in range(7)}
    
    total_hours = 0.0
    
    for e in entries:
        day_idx = e.start_time.date().weekday() # 0=Mon, 6=Sun
        duration_hours = round(e.duration_minutes / 60, 2)
        
        grid[day_idx]["hours"] += duration_hours
        grid[day_idx]["entries"].append({
            "id": e.id,
            "ticket_id": e.ticket_id,
            "description": e.description,
            "hours": duration_hours,
            "ticket_subject": e.ticket.subject if e.ticket else "Unknown"
        })
        total_hours += duration_hours

    return {
        "start_date": start_of_week,
        "end_date": end_of_week,
        "total_hours": round(total_hours, 2),
        "days": list(grid.values())
    }

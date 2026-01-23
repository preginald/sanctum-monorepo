from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import List
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/revenue-trend")
def get_revenue_trend(db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_active_user)):
    # Group invoices by month for last 6 months
    six_months_ago = datetime.now() - timedelta(days=180)
    
    results = db.query(
        func.to_char(models.Invoice.generated_at, 'YYYY-MM').label('month'),
        func.sum(models.Invoice.total_amount).label('revenue')
    ).filter(
        models.Invoice.generated_at >= six_months_ago
    ).group_by('month').order_by('month').all()
    
    return [{"month": r.month, "revenue": float(r.revenue)} for r in results]

@router.get("/asset-reliability")
def get_asset_reliability(db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_active_user)):
    # Top 5 Assets by Ticket Count
    # Requires joining Ticket -> Asset via Association Table
    # Complex query: select asset.name, count(ticket.id) from assets join ticket_assets ... group by asset.name
    
    results = db.query(
        models.Asset.name,
        func.count(models.Ticket.id).label('ticket_count')
    ).join(models.Asset.tickets)\
     .group_by(models.Asset.name)\
     .order_by(func.count(models.Ticket.id).desc())\
     .limit(5).all()
     
    return [{"name": r.name, "tickets": r.ticket_count} for r in results]

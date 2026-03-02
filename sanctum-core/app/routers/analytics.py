from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, date
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


@router.get("/cash-position")
def get_cash_position(db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_active_user)):
    today = date.today()

    unpaid = db.query(models.Invoice).filter(
        models.Invoice.status.in_(['draft', 'sent']),
        models.Invoice.total_amount > 0
    ).all()

    current = overdue_30 = overdue_60 = overdue_90 = 0.0
    total_outstanding = 0.0
    total_overdue = 0.0

    for inv in unpaid:
        amount = float(inv.total_amount or 0)
        total_outstanding += amount
        if not inv.due_date:
            current += amount
            continue
        days_overdue = (today - inv.due_date).days
        if days_overdue <= 0:
            current += amount
        elif days_overdue <= 30:
            overdue_30 += amount
            total_overdue += amount
        elif days_overdue <= 60:
            overdue_60 += amount
            total_overdue += amount
        else:
            overdue_90 += amount
            total_overdue += amount

    return {
        "total_outstanding": total_outstanding,
        "total_overdue": total_overdue,
        "buckets": [
            {"label": "Current", "amount": current},
            {"label": "1–30 Days", "amount": overdue_30},
            {"label": "31–60 Days", "amount": overdue_60},
            {"label": "60+ Days", "amount": overdue_90},
        ]
    }


@router.get("/pipeline-forecast")
def get_pipeline_forecast(db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_active_user)):
    today = date.today()

    milestones = db.query(models.Milestone).filter(
        models.Milestone.invoice_id == None,
        models.Milestone.billable_amount > 0,
        models.Milestone.status != 'completed'
    ).all()

    bucket_30 = bucket_60 = bucket_90 = bucket_beyond = 0.0
    items = []

    for ms in milestones:
        amount = float(ms.billable_amount or 0)
        if ms.due_date:
            days = (ms.due_date - today).days
            if days <= 30:
                bucket_30 += amount
            elif days <= 60:
                bucket_60 += amount
            elif days <= 90:
                bucket_90 += amount
            else:
                bucket_beyond += amount
        else:
            bucket_beyond += amount

        items.append({
            "name": ms.name,
            "amount": amount,
            "due_date": ms.due_date.isoformat() if ms.due_date else None,
            "status": ms.status
        })

    return {
        "total": sum(float(ms.billable_amount or 0) for ms in milestones),
        "buckets": [
            {"label": "0–30 Days", "amount": bucket_30},
            {"label": "31–60 Days", "amount": bucket_60},
            {"label": "61–90 Days", "amount": bucket_90},
            {"label": "90+ Days", "amount": bucket_beyond},
        ],
        "items": sorted(items, key=lambda x: (x["due_date"] or "9999"))
    }


@router.get("/recurring-revenue")
def get_recurring_revenue(db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_active_user)):
    assets = db.query(models.Asset).join(
        models.Product, models.Asset.linked_product_id == models.Product.id
    ).filter(
        models.Product.is_recurring == True,
        models.Asset.status == 'active'
    ).all()

    mrr = 0.0
    breakdown = {}

    for asset in assets:
        product = asset.linked_product
        price = float(product.unit_price or 0)
        freq = (product.billing_frequency or 'monthly').lower()

        if freq in ('annual', 'yearly'):
            monthly = price / 12
        elif freq == 'quarterly':
            monthly = price / 3
        else:
            monthly = price

        mrr += monthly
        breakdown[product.name] = breakdown.get(product.name, 0) + monthly

    return {
        "mrr": round(mrr, 2),
        "arr": round(mrr * 12, 2),
        "breakdown": [
            {"name": k, "value": round(v, 2)}
            for k, v in sorted(breakdown.items(), key=lambda x: -x[1])
        ]
    }


@router.get("/budget-vs-actual")
def get_budget_vs_actual(db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_active_user)):
    projects = db.query(models.Project).filter(
        models.Project.budget > 0,
        models.Project.is_deleted == False
    ).all()

    result = []
    for project in projects:
        budget = float(project.budget or 0)
        actual = 0.0
        for ms in project.milestones:
            if ms.invoice and ms.invoice.status == 'paid':
                actual += float(ms.invoice.total_amount or 0)

        result.append({
            "project": project.name,
            "budget": budget,
            "actual": round(actual, 2),
            "variance": round(budget - actual, 2),
            "utilisation": round((actual / budget * 100) if budget > 0 else 0, 1)
        })

    return sorted(result, key=lambda x: -x["budget"])

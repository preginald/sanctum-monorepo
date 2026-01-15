from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/portal", tags=["Portal"])

@router.get("/dashboard", response_model=schemas.PortalDashboard)
def get_portal_dashboard(current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    if current_user.role != 'client' or not current_user.account_id: raise HTTPException(status_code=403, detail="Portal access only.")
    aid = current_user.account_id
    account = db.query(models.Account).filter(models.Account.id == aid).first()
    tickets = db.query(models.Ticket).options(joinedload(models.Ticket.time_entries), joinedload(models.Ticket.materials)).filter(models.Ticket.account_id == aid, models.Ticket.is_deleted == False).order_by(desc(models.Ticket.created_at)).all()
    invoices = db.query(models.Invoice).options(joinedload(models.Invoice.items)).filter(models.Invoice.account_id == aid).order_by(desc(models.Invoice.generated_at)).all()
    projects = db.query(models.Project).options(joinedload(models.Project.milestones)).filter(models.Project.account_id == aid, models.Project.is_deleted == False).all()
    last_audit = db.query(models.AuditReport).filter(models.AuditReport.account_id == aid, models.AuditReport.status == 'finalized').order_by(desc(models.AuditReport.finalized_at)).first()
    score = last_audit.security_score if last_audit else 0
    return { "account": account, "security_score": score, "open_tickets": tickets, "invoices": invoices, "projects": projects }
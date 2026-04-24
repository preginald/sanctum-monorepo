from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from .. import models, schemas, auth
from ..database import get_db
from ..services.ticket_validation import auto_transition_from_new
from ..services.notification_service import notification_service
from ..services.event_bus import event_bus
from ..services.uuid_resolver import get_or_404

router = APIRouter(tags=["Comments"])

@router.get("/comments", response_model=List[schemas.CommentResponse])
def get_comments(ticket_id: Optional[int] = None, deal_id: Optional[str] = None, audit_id: Optional[str] = None, resolve_embeds: bool = False, db: Session = Depends(get_db)):
    query = db.query(models.Comment)
    if ticket_id: query = query.filter(models.Comment.ticket_id == ticket_id)
    if deal_id: query = query.filter(models.Comment.deal_id == deal_id)
    if audit_id: query = query.filter(models.Comment.audit_id == audit_id)
    comments = query.order_by(models.Comment.created_at.desc()).all()
    for c in comments: c.author_name = c.author.full_name
    if resolve_embeds:
        from ..services.content_engine import resolve_content
        for comment in comments:
            if comment.body:
                comment.body = resolve_content(db, comment.body)
    return comments

@router.post("/comments", response_model=schemas.CommentResponse)
def create_comment(comment: schemas.CommentCreate, background_tasks: BackgroundTasks, current_user: models.User = Depends(auth.get_current_active_user), resolve_embeds: bool = False, db: Session = Depends(get_db)):
    # Auto-transition ticket from 'new' → 'open' when commenting (#774)
    if comment.ticket_id:
        ticket = db.query(models.Ticket).filter(models.Ticket.id == comment.ticket_id).first()
        if ticket:
            applied, auto_from, auto_to = auto_transition_from_new(ticket, db)
            if applied:
                from .tickets import _record_transition
                _record_transition(db, ticket.id, auto_from, auto_to, changed_by=current_user.full_name or "system")

    new_comment = models.Comment(
        author_id=current_user.id, body=comment.body, visibility=comment.visibility,
        ticket_id=comment.ticket_id, deal_id=comment.deal_id, audit_id=comment.audit_id,
        mirror=bool(getattr(comment, 'mirror', False)),
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)
    new_comment.author_name = current_user.full_name or current_user.email

    # Notify assigned tech of new comment (via Notify API)
    if comment.ticket_id and comment.visibility == 'public':
        ticket = db.query(models.Ticket).filter(models.Ticket.id == comment.ticket_id).first()
        if ticket and ticket.assigned_tech_id and str(ticket.assigned_tech_id) != str(current_user.id):
            tech = db.query(models.User).filter(models.User.id == ticket.assigned_tech_id).first()
            if tech:
                frontend_url = os.getenv("FRONTEND_URL", "https://core.digitalsanctum.com.au")
                notification_service.enqueue(
                    db,
                    recipients=[{ 'type': 'user', 'user_id': str(tech.id), 'email': tech.email }],
                    subject=f"New Comment: #{ticket.id}",
                    message=f"New comment on ticket #{ticket.id} ({ticket.subject})",
                    link=f"/tickets/{ticket.id}",
                    priority=ticket.priority,
                    event_type="ticket_comment",
                    template_data={
                        "ticket_id": ticket.id,
                        "subject_line": ticket.subject,
                        "comment_author": current_user.full_name or current_user.email,
                        "comment_body": comment.body[:500] if comment.body else "",
                        "url": f"{frontend_url}/tickets/{ticket.id}",
                    },
                )

    # Emit workbench ticket_comment event for in_app notifications (#2758)
    if comment.ticket_id:
        ticket_for_event = db.query(models.Ticket).filter(models.Ticket.id == comment.ticket_id).first()
        if ticket_for_event:
            event_bus.emit("ticket_comment", {
                "ticket_id": ticket_for_event.id,
                "event_type": "ticket_comment",
                "actor_user_id": str(current_user.id),
                "title": f"New Comment: #{ticket_for_event.id}",
                "message": f"{current_user.full_name or current_user.email} commented on #{ticket_for_event.id} ({ticket_for_event.subject})",
                "link": f"/tickets/{ticket_for_event.id}",
                "priority": ticket_for_event.priority,
            }, background_tasks)

    return new_comment

@router.delete("/comments/{comment_id}")
def delete_comment(comment_id: str, current_user: models.User = Depends(auth.get_current_active_user), resolve_embeds: bool = False, db: Session = Depends(get_db)):
    comment = get_or_404(db, models.Comment, comment_id, deleted_filter=False)
    if str(comment.author_id) != str(current_user.id) and current_user.role != "admin":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Not authorised to delete this comment")
    db.delete(comment)
    db.commit()
    return {"deleted": comment_id}

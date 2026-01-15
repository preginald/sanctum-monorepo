from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(tags=["Comments"])

@router.get("/comments", response_model=List[schemas.CommentResponse])
def get_comments(ticket_id: Optional[int] = None, deal_id: Optional[str] = None, audit_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Comment)
    if ticket_id: query = query.filter(models.Comment.ticket_id == ticket_id)
    if deal_id: query = query.filter(models.Comment.deal_id == deal_id)
    if audit_id: query = query.filter(models.Comment.audit_id == audit_id)
    comments = query.order_by(models.Comment.created_at.desc()).all()
    for c in comments: c.author_name = c.author.full_name
    return comments

@router.post("/comments", response_model=schemas.CommentResponse)
def create_comment(comment: schemas.CommentCreate, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    new_comment = models.Comment(
        author_id=current_user.id, body=comment.body, visibility=comment.visibility,
        ticket_id=comment.ticket_id, deal_id=comment.deal_id, audit_id=comment.audit_id
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)
    new_comment.author_name = current_user.full_name or current_user.email
    return new_comment
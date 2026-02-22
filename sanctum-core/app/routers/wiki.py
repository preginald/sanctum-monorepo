from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from .. import models, schemas, auth
from ..models import Article, ArticleHistory
from ..database import get_db
from uuid import UUID
import re
import os
from ..services.content_engine import resolve_content

router = APIRouter(tags=["Wiki"])

# --- HELPERS ---

def _generate_identifier(db: Session, category: str) -> str:
    """
    Generates a unique ID based on category prefixes.
    SOP -> SOP-001
    Troubleshooting -> TRB-001
    Wiki -> WIKI-001
    Template -> TPL-001
    """
    prefix_map = {
        'sop': 'SOP',
        'troubleshooting': 'TRB',
        'wiki': 'WIKI',
        'template': 'TPL'
    }
    prefix = prefix_map.get(category.lower(), 'DOC')
    
    # Find the highest ID with this prefix
    # We filter by length to ensure we are comparing "SOP-001" not "SOP-1000" wrongly if sorting string wise
    # Ideally we'd use a regex query, but for compatibility let's fetch the last created
    last_article = db.query(models.Article)\
        .filter(models.Article.identifier.ilike(f"{prefix}-%"))\
        .order_by(models.Article.created_at.desc())\
        .first()

    next_num = 1
    if last_article and last_article.identifier:
        try:
            # Extract the number part
            parts = last_article.identifier.split('-')
            if len(parts) >= 2 and parts[-1].isdigit():
                next_num = int(parts[-1]) + 1
        except Exception:
            pass # Fallback to 1 if parsing fails

    return f"{prefix}-{str(next_num).zfill(3)}"

def _increment_version(current_version: str) -> str:
    """
    Parses v1.0 -> v1.1. 
    Handles basic integer or float strings gracefully.
    """
    if not current_version: 
        return "v1.0"
    
    # Regex to find major.minor
    match = re.search(r"v?(\d+)\.(\d+)", current_version)
    if match:
        major = match.group(1)
        minor = int(match.group(2))
        return f"v{major}.{minor + 1}"
    
    return "v1.1" # Fallback reset

# --- ENDPOINTS ---

@router.get("/articles", response_model=List[schemas.ArticleResponse])
def get_articles(category: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Article).options(joinedload(models.Article.author))
    if category: query = query.filter(models.Article.category == category)
    articles = query.order_by(models.Article.identifier.asc()).all()
    
    for a in articles:
        if a.author: a.author_name = a.author.full_name
        
    return articles

@router.get("/articles/{slug}", response_model=schemas.ArticleResponse)
def get_article_detail(slug: str, resolve_embeds: bool = False, db: Session = Depends(get_db)):
    query = db.query(models.Article).options(joinedload(models.Article.author))
    try:
        uid = UUID(slug)
        article = query.filter(models.Article.id == uid).first()
    except ValueError:
        article = query.filter(models.Article.slug == slug).first()
        
    if not article: raise HTTPException(status_code=404, detail="Article not found")
    
    if article.author: article.author_name = article.author.full_name
    
    # Parse into Pydantic model while still attached to the session
    # This safely loads all lazy attributes (like 'history') without DetachedInstanceError
    response_data = schemas.ArticleResponse.model_validate(article)
    
    # Resolve shortcodes safely on the Pydantic object
    if resolve_embeds and response_data.content:
        response_data.content = resolve_content(db, response_data.content)
        
    return response_data

@router.post("/articles", response_model=schemas.ArticleResponse)
def create_article(article: schemas.ArticleCreate, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    if current_user.role == 'client': raise HTTPException(status_code=403, detail="Forbidden")
    
    article_data = article.model_dump()
    
    # AUTOMATION: Generate Identifier if missing
    if not article_data.get('identifier'):
        article_data['identifier'] = _generate_identifier(db, article_data.get('category', 'wiki'))
        
    new_article = models.Article(**article_data, author_id=current_user.id)
    db.add(new_article)
    db.commit()
    db.refresh(new_article)
    return new_article

@router.put("/articles/{article_id}", response_model=schemas.ArticleResponse)
def update_article(
    article_id: str, 
    update: schemas.ArticleUpdate, 
    current_user: models.User = Depends(auth.get_current_active_user), 
    db: Session = Depends(get_db)
):
    article = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not article: raise HTTPException(status_code=404, detail="Article not found")
    
    # 1. HISTORY SNAPSHOT
    history_entry = models.ArticleHistory(
        article_id=article.id,
        author_id=article.author_id, 
        title=article.title,
        content=article.content,
        version=article.version
    )
    db.add(history_entry)
    
    update_data = update.model_dump(exclude_unset=True)

    # 2. AUTOMATION: Smart Versioning
    # If version is missing OR matches the current DB version, we auto-increment
    payload_version = update_data.get('version')
    
    if not payload_version or payload_version == article.version:
        # Calculate new version
        article.version = _increment_version(article.version)
        # CRITICAL: Remove 'version' from update_data so the loop below doesn't overwrite our new value with the old one
        if 'version' in update_data:
            del update_data['version']
    
    # 3. APPLY UPDATE
    for key, value in update_data.items(): 
        setattr(article, key, value)
    
    article.author_id = current_user.id
    
    db.commit()
    db.refresh(article)
    return article


@router.get("/articles/{article_id}/history", response_model=List[schemas.ArticleHistoryResponse])
def get_article_history(article_id: str, db: Session = Depends(get_db)):
    history = db.query(models.ArticleHistory).options(joinedload(models.ArticleHistory.author))\
        .filter(models.ArticleHistory.article_id == article_id)\
        .order_by(models.ArticleHistory.snapshot_at.desc()).all()
        
    for h in history:
        if h.author: h.author_name = h.author.full_name
        
    return history

@router.get("/articles/{article_id}/pdf")
def download_article_pdf(article_id: str, db: Session = Depends(get_db)):
    from ..services.pdf_engine import pdf_engine
    
    query = db.query(models.Article).options(joinedload(models.Article.author))
    try:
        uid = UUID(article_id)
        article = query.filter(models.Article.id == uid).first()
    except ValueError:
        article = query.filter(models.Article.slug == article_id).first()
    
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    data = {
        "title": article.title,
        "identifier": article.identifier,
        "version": article.version,
        "category": article.category,
        "content": article.content or "",
        "author_name": article.author.full_name if article.author else "Unknown",
        "updated_at": article.updated_at.strftime("%d %b %Y") if article.updated_at else 
                      article.created_at.strftime("%d %b %Y") if article.created_at else ""
    }
    
    filepath = pdf_engine.generate_article_pdf(data)
    
    from fastapi.responses import FileResponse
    return FileResponse(filepath, media_type='application/pdf', filename=f"{article.identifier or article.title}.pdf")

@router.post("/articles/{article_id}/email")
def email_article(
    article_id: str,
    request: schemas.ArticleEmailRequest,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    from ..services.pdf_engine import pdf_engine
    from ..services.email_service import email_service

    query = db.query(models.Article).options(joinedload(models.Article.author))
    try:
        uid = UUID(article_id)
        article = query.filter(models.Article.id == uid).first()
    except ValueError:
        article = query.filter(models.Article.slug == article_id).first()

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Generate PDF
    data = {
        "title": article.title,
        "identifier": article.identifier,
        "version": article.version,
        "category": article.category,
        "content": article.content or "",
        "author_name": article.author.full_name if article.author else "Unknown",
        "updated_at": article.updated_at.strftime("%d %b %Y") if article.updated_at else
                      article.created_at.strftime("%d %b %Y") if article.created_at else ""
    }
    filepath = pdf_engine.generate_article_pdf(data)

    # Resolve greeting
    greeting = "Team"
    if request.recipient_contact_id:
        contact = db.query(models.Contact).filter(models.Contact.id == request.recipient_contact_id).first()
        if contact:
            greeting = contact.first_name

    context = {
        "client_name": greeting,
        "article_title": article.title,
        "article_ref": article.identifier or "",
        "custom_message": request.message or f"Please find attached the knowledge article: {article.title}."
    }

    subject = request.subject or f"{article.identifier or 'Article'}: {article.title} - Digital Sanctum"

    success = email_service.send_template(
        to_email=request.to_email.strip(),
        subject=subject,
        template_name="article_delivery.html",
        context=context,
        cc_emails=[e.strip() for e in request.cc_emails if e.strip()],
        attachments=[filepath]
    )

    if not success:
        raise HTTPException(status_code=500, detail="Email failed")

    return {"status": "sent", "to": request.to_email}
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
        'standard operating procedure': 'SOP',
        'system documentation': 'SYS',
        'developer documentation': 'DOC',
        'troubleshooting guide': 'TRB',
        'general knowledge': 'WIKI',
        'template': 'TPL',
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
def get_article_detail(slug: str, resolve_embeds: bool = False, inline_embeds: bool = False, db: Session = Depends(get_db)):
    query = db.query(models.Article).options(joinedload(models.Article.author))
    try:
        uid = UUID(slug)
        article = query.filter(models.Article.id == uid).first()
    except ValueError:
        article = query.filter(models.Article.slug == slug).first()

    if not article: raise HTTPException(status_code=404, detail="Article not found")

    if article.author: article.author_name = article.author.full_name

    # Load related articles from both directions of the join table
    from sqlalchemy import or_
    ar = models.article_relations
    related_ids_a = db.query(ar.c.related_id).filter(ar.c.article_id == article.id)
    related_ids_b = db.query(ar.c.article_id).filter(ar.c.related_id == article.id)
    related = db.query(models.Article).filter(
        or_(models.Article.id.in_(related_ids_a), models.Article.id.in_(related_ids_b))
    ).all()

    # Parse into Pydantic model while still attached to the session
    # This safely loads all lazy attributes (like 'history') without DetachedInstanceError
    response_data = schemas.ArticleResponse.model_validate(article)
    response_data.related_articles = [
        schemas.RelatedArticleResponse(
            id=r.id, title=r.title, slug=r.slug,
            identifier=r.identifier, category=r.category
        ) for r in related
    ]

    # Resolve shortcodes safely on the Pydantic object
    if resolve_embeds and response_data.content:
        response_data.content = resolve_content(db, response_data.content)
    elif inline_embeds and response_data.content:
        response_data.content = resolve_content(db, response_data.content, inline_mode=True)

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
    # Capture old content before overwrite
    old_content = article.content
    history_entry = models.ArticleHistory(
        article_id=article.id,
        author_id=article.author_id,
        title=article.title,
        content=article.content,
        version=article.version,
        section_heading=None,
        diff_before=old_content,
        diff_after=None,  # populated post-commit via update_article_history_after
        change_comment=update.change_comment
    )
    db.add(history_entry)

    update_data = update.model_dump(exclude_unset=True)
    update_data.pop("change_comment", None)  # not an article field

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
    # Capture diff_after now that content has been updated
    if update_data.get("content"):
        history_entry.diff_after = article.content


    db.commit()
    db.refresh(article)
    return article


@router.patch("/articles/{article_id}/sections", response_model=schemas.ArticleResponse)
def patch_article_section(
    article_id: str,
    patch: schemas.ArticleSectionPatch,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    article = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Determine heading level (e.g. "## " -> level 2)
    heading_match = re.match(r'^(#{1,6})\s', patch.heading)
    if not heading_match:
        raise HTTPException(status_code=400, detail="heading must start with one or more # characters")
    level = len(heading_match.group(1))
    hashes = '#' * level
    heading_pattern = re.escape(patch.heading)

    # Match from heading line to next heading of same or higher level (or end of string)
    stop_pattern = '(?=^' + hashes[0] + '{1,' + str(level) + '}[^#]|\Z)'
    section_re = re.compile(
        '(^' + heading_pattern + '\n)(.*?)' + stop_pattern,
        re.MULTILINE | re.DOTALL
    )

    if not section_re.search(article.content):
        raise HTTPException(status_code=404, detail="Section not found: " + patch.heading)

    # 1. HISTORY SNAPSHOT
    # Capture old section content before overwrite
    old_section_match = section_re.search(article.content)
    old_section_body = old_section_match.group(2) if old_section_match else ""
    history_entry = models.ArticleHistory(
        article_id=article.id,
        author_id=article.author_id,
        title=article.title,
        content=article.content,
        version=article.version,
        section_heading=patch.heading,
        diff_before=old_section_body,
        diff_after=patch.content,
        change_comment=patch.change_comment
    )
    db.add(history_entry)

    # 2. REPLACE SECTION — heading line preserved, body replaced
    new_body = patch.content.strip('\n') + '\n'
    article.content = section_re.sub(
        lambda m: patch.heading + '\n' + new_body,
        article.content,
        count=1
    )

    # 3. VERSION BUMP
    article.version = _increment_version(article.version)
    article.author_id = current_user.id

    db.commit()
    db.refresh(article)
    return article

@router.get("/articles/{article_id}/history", response_model=schemas.Page[schemas.ArticleHistoryResponse])
def get_article_history(
    article_id: str,
    page: int = 1,
    page_size: int = 20,
    section_heading: str = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.ArticleHistory).options(joinedload(models.ArticleHistory.author))\
        .filter(models.ArticleHistory.article_id == article_id)
    if section_heading:
        query = query.filter(models.ArticleHistory.section_heading == section_heading)
    total = query.count()
    items = query.order_by(models.ArticleHistory.snapshot_at.desc())\
        .offset((page - 1) * page_size).limit(page_size).all()
    for h in items:
        if h.author: h.author_name = h.author.full_name
    return schemas.Page(
        total=total,
        page=page,
        page_size=page_size,
        items=items
    )

@router.post("/articles/{article_id}/revert/{history_id}", response_model=schemas.ArticleResponse)
def revert_article(
    article_id: str,
    history_id: str,
    revert_request: schemas.ArticleRevertRequest = None,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    article = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    history_entry = db.query(models.ArticleHistory).filter(
        models.ArticleHistory.id == history_id,
        models.ArticleHistory.article_id == article_id
    ).first()
    if not history_entry:
        raise HTTPException(status_code=404, detail="History entry not found for this article")

    fields = (revert_request.fields if revert_request and revert_request.fields else ["content", "title"])
    valid_fields = {"content", "title"}
    if not set(fields).issubset(valid_fields):
        raise HTTPException(status_code=400, detail=f"Invalid fields. Allowed: {valid_fields}")

    # 1. HISTORY SNAPSHOT (capture current state before revert)
    default_comment = f"Reverted to {history_entry.version}"
    change_comment = (revert_request.change_comment if revert_request and revert_request.change_comment else default_comment)
    snapshot = models.ArticleHistory(
        article_id=article.id,
        author_id=article.author_id,
        title=article.title,
        content=article.content,
        version=article.version,
        section_heading=None,
        diff_before=article.content,
        diff_after=history_entry.content if "content" in fields else article.content,
        change_comment=change_comment
    )
    db.add(snapshot)

    # 2. APPLY REVERT
    if "content" in fields:
        article.content = history_entry.content
    if "title" in fields:
        article.title = history_entry.title

    # 3. VERSION BUMP
    article.version = _increment_version(article.version)
    article.author_id = current_user.id

    db.commit()
    db.refresh(article)
    return article


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


@router.post("/articles/{article_id}/relations")
def add_article_relation(
    article_id: str,
    payload: dict,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role == 'client':
        raise HTTPException(status_code=403, detail="Forbidden")
    related_id = payload.get("related_id")
    if not related_id:
        raise HTTPException(status_code=422, detail="related_id required")
    if article_id == related_id:
        raise HTTPException(status_code=422, detail="An article cannot relate to itself")
    ar = models.article_relations
    from sqlalchemy import or_, and_
    exists = db.execute(
        ar.select().where(
            or_(
                and_(ar.c.article_id == article_id, ar.c.related_id == related_id),
                and_(ar.c.article_id == related_id, ar.c.related_id == article_id)
            )
        )
    ).first()
    if exists:
        return {"status": "already_exists"}
    db.execute(ar.insert().values(article_id=article_id, related_id=related_id))
    db.commit()
    return {"status": "linked"}


@router.delete("/articles/{article_id}/relations/{related_id}")
def remove_article_relation(
    article_id: str,
    related_id: str,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role == 'client':
        raise HTTPException(status_code=403, detail="Forbidden")
    ar = models.article_relations
    from sqlalchemy import or_, and_
    db.execute(
        ar.delete().where(
            or_(
                and_(ar.c.article_id == article_id, ar.c.related_id == related_id),
                and_(ar.c.article_id == related_id, ar.c.related_id == article_id)
            )
        )
    )
    db.commit()
    return {"status": "unlinked"}

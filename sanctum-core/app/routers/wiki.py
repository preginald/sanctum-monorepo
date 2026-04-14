from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func as sa_func_top
from typing import List, Optional
from .. import models, schemas, auth
from ..models import Article, ArticleHistory
from ..database import get_db
from ..services.pagination import pagination_params
from uuid import UUID
import re
import os
from ..services.content_engine import resolve_content
from ..services.expand import ExpandConfig, get_expand_config, expanded_response
from ..services.uuid_resolver import resolve_uuid

router = APIRouter(tags=["Wiki"])

# --- HELPERS ---

IDENTIFIER_PREFIX_MAP = {
    'standard operating procedure': 'SOP',
    'system documentation': 'SYS',
    'developer documentation': 'DOC',
    'developer-docs': 'DOC',
    'troubleshooting guide': 'TRB',
    'general knowledge': 'WIKI',
    'template': 'TPL',
}


def _resolve_article(db: Session, article_id: str):
    """Resolve an article by UUID, UUID prefix (8+ hex), slug, or identifier (e.g. DOC-009)."""
    # 1. Full UUID
    try:
        uid = UUID(article_id)
        return db.query(models.Article).filter(models.Article.id == uid).first()
    except ValueError:
        pass

    # 2. UUID prefix (8+ hex chars after stripping dashes)
    clean = article_id.replace("-", "")
    if len(clean) >= 8 and all(c in "0123456789abcdefABCDEF" for c in clean):
        try:
            resolved_id = resolve_uuid(db, models.Article, article_id, deleted_filter=False)
            return db.query(models.Article).filter(models.Article.id == resolved_id).first()
        except HTTPException as e:
            if e.status_code in (409, 422):
                raise
            pass  # 404 falls through to slug/identifier

    # 3. Slug
    article = db.query(models.Article).filter(models.Article.slug == article_id).first()
    if article:
        return article

    # 4. Identifier (e.g. DOC-009)
    return db.query(models.Article).filter(models.Article.identifier == article_id.upper()).first()


def _generate_identifier(db: Session, category: str) -> str:
    """
    Generates the next sequential identifier for a category prefix.
    Scans all existing identifiers with the prefix and picks MAX(n)+1.
    The UNIQUE constraint on articles.identifier prevents race conditions —
    if two concurrent creates collide, the DB rejects the second insert.
    """
    prefix = IDENTIFIER_PREFIX_MAP.get(category.lower(), 'DOC')

    existing = db.query(models.Article.identifier)\
        .filter(models.Article.identifier.ilike(f"{prefix}-%"))\
        .all()

    max_num = 0
    for (ident,) in existing:
        if ident:
            parts = ident.split('-')
            if len(parts) >= 2 and parts[-1].isdigit():
                max_num = max(max_num, int(parts[-1]))

    return f"{prefix}-{str(max_num + 1).zfill(3)}"


def _check_identifier_conflict(db: Session, identifier: str, exclude_id: str = None):
    """Raises 409 if identifier is already used by another article."""
    query = db.query(models.Article).filter(models.Article.identifier == identifier)
    if exclude_id:
        query = query.filter(models.Article.id != exclude_id)
    existing = query.first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "identifier_conflict",
                "identifier": identifier,
                "existing_article_id": str(existing.id),
                "existing_article_title": existing.title,
                "message": f"Identifier {identifier} is already assigned to another article.",
            },
        )

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
def get_articles(
    category: Optional[str] = None,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    filters = []
    if category:
        filters.append(models.Article.category == category)

    total = db.query(sa_func_top.count(models.Article.id)).filter(*filters).scalar() if filters else db.query(sa_func_top.count(models.Article.id)).scalar()

    query = db.query(models.Article).options(joinedload(models.Article.author))
    if filters:
        query = query.filter(*filters)
    articles = query.order_by(models.Article.identifier.asc()).offset(offset).limit(limit).all()

    for a in articles:
        if a.author: a.author_name = a.author.full_name

    result = jsonable_encoder([schemas.ArticleResponse.model_validate(a) for a in articles])
    for item in result:
        item.pop("content", None)
    return JSONResponse(content=result, headers={"X-Total-Count": str(total)})

@router.get("/articles/{slug}", response_model=schemas.ArticleResponse)
def get_article_detail(slug: str, resolve_embeds: bool = False, inline_embeds: bool = False, expand: ExpandConfig = Depends(get_expand_config), db: Session = Depends(get_db)):
    article = _resolve_article(db, slug)
    if article:
        # Re-fetch with eager loads
        article = db.query(models.Article).options(joinedload(models.Article.author)).filter(models.Article.id == article.id).first()

    if not article: raise HTTPException(status_code=404, detail="Article not found")

    if article.author: article.author_name = article.author.full_name

    # Load related articles (needed for count even when not expanding)
    from sqlalchemy import or_, func as sa_func
    ar = models.article_relations
    related_ids_a = db.query(ar.c.related_id).filter(ar.c.article_id == article.id)
    related_ids_b = db.query(ar.c.article_id).filter(ar.c.related_id == article.id)

    if expand.should_expand("related_articles"):
        related = db.query(models.Article).filter(
            or_(models.Article.id.in_(related_ids_a), models.Article.id.in_(related_ids_b))
        ).all()
        related_article_count = len(related)
    else:
        related = []
        related_article_count = db.query(sa_func.count()).filter(
            or_(
                models.Article.id.in_(related_ids_a),
                models.Article.id.in_(related_ids_b),
            )
        ).scalar()

    # Parse into Pydantic model while still attached to the session
    response_data = schemas.ArticleResponse.model_validate(article)
    response_data.related_articles = [
        schemas.RelatedArticleResponse(
            id=r.id, title=r.title, slug=r.slug,
            identifier=r.identifier, category=r.category
        ) for r in related
    ]

    # Counts
    response_data.revision_count = len(response_data.history)
    response_data.related_article_count = related_article_count

    # Load linked artefacts
    try:
        artefact_ids = db.query(models.ArtefactLink.artefact_id).filter(
            models.ArtefactLink.linked_entity_type == "article",
            models.ArtefactLink.linked_entity_id == str(article.id),
        ).all()
        if artefact_ids:
            ids = [r[0] for r in artefact_ids]
            if expand.should_expand("artefacts"):
                response_data.artefacts = [
                    schemas.ArtefactLite(id=a.id, name=a.name, artefact_type=a.artefact_type, url=a.url)
                    for a in db.query(models.Artefact).filter(
                        models.Artefact.id.in_(ids), models.Artefact.is_deleted == False
                    ).all()
                ]
            response_data.artefact_count = len(artefact_ids)
        else:
            response_data.artefact_count = 0
    except Exception:
        db.rollback()
        response_data.artefact_count = 0

    # Resolve shortcodes only when content will be included in response
    if expand.should_expand("content"):
        if resolve_embeds and response_data.content:
            response_data.content = resolve_content(db, response_data.content)
        elif inline_embeds and response_data.content:
            response_data.content = resolve_content(db, response_data.content, inline_mode=True)

    result = jsonable_encoder(response_data)
    return expanded_response(result, expand, "article")

@router.post("/articles", response_model=schemas.ArticleResponse)
def create_article(article: schemas.ArticleCreate, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    if current_user.role == 'client': raise HTTPException(status_code=403, detail="Forbidden")

    article_data = article.model_dump()

    # AUTOMATION: Generate Identifier if missing
    if not article_data.get('identifier'):
        article_data['identifier'] = _generate_identifier(db, article_data.get('category', 'wiki'))
    else:
        _check_identifier_conflict(db, article_data['identifier'])

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
    article = _resolve_article(db, article_id)
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

    # 1b. IDENTIFIER CONFLICT CHECK
    if 'identifier' in update_data and update_data['identifier'] != article.identifier:
        _check_identifier_conflict(db, update_data['identifier'], exclude_id=str(article.id))

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


@router.get("/articles/{article_id}/sections")
def get_article_sections(
    article_id: str,
    section: Optional[str] = None,
    index: int = 0,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    """List section headings, or return a single section body if ?section= is provided."""
    from ..services.section_parser import get_headings, get_section as _get_section

    article = _resolve_article(db, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    if section:
        result = _get_section(article.content or "", section, index=index)
        if not result:
            raise HTTPException(status_code=404, detail=f"Section not found: {section}")
        return schemas.SectionDetail(
            heading=result.heading, level=result.level,
            index=result.index, body=result.body,
        )

    headings = get_headings(article.content or "")
    return [
        schemas.SectionHeading(heading=h.heading, level=h.level, index=h.index)
        for h in headings
    ]


@router.patch("/articles/{article_id}/sections", response_model=schemas.ArticleResponse)
def patch_article_section(
    article_id: str,
    patch: schemas.ArticleSectionPatch,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    from ..services.section_parser import get_section as _get_section, replace_section

    article = _resolve_article(db, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Validate heading format
    heading_match = re.match(r'^(#{1,6})\s', patch.heading)
    if not heading_match:
        raise HTTPException(status_code=400, detail="heading must start with one or more # characters")

    # Find existing section for history snapshot
    old_section = _get_section(article.content or "", patch.heading)
    if not old_section:
        raise HTTPException(status_code=404, detail="Section not found: " + patch.heading)

    # 1. HISTORY SNAPSHOT
    history_entry = models.ArticleHistory(
        article_id=article.id,
        author_id=article.author_id,
        title=article.title,
        content=article.content,
        version=article.version,
        section_heading=patch.heading,
        diff_before=old_section.body,
        diff_after=patch.content,
        change_comment=patch.change_comment
    )
    db.add(history_entry)

    # 2. REPLACE SECTION — heading line preserved, body replaced
    try:
        article.content = replace_section(article.content, patch.heading, patch.content)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

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
    article = _resolve_article(db, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    query = db.query(models.ArticleHistory).options(joinedload(models.ArticleHistory.author))\
        .filter(models.ArticleHistory.article_id == article.id)
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
    article = _resolve_article(db, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    history_entry = db.query(models.ArticleHistory).filter(
        models.ArticleHistory.id == history_id,
        models.ArticleHistory.article_id == article.id
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

    article = _resolve_article(db, article_id)
    if article:
        article = db.query(models.Article).options(joinedload(models.Article.author)).filter(models.Article.id == article.id).first()

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

    article = _resolve_article(db, article_id)
    if article:
        article = db.query(models.Article).options(joinedload(models.Article.author)).filter(models.Article.id == article.id).first()

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

    # Resolve both IDs to full UUIDs
    article = _resolve_article(db, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    related = _resolve_article(db, related_id)
    if not related:
        raise HTTPException(status_code=404, detail="Related article not found")

    if article.id == related.id:
        raise HTTPException(status_code=422, detail="An article cannot relate to itself")
    ar = models.article_relations
    from sqlalchemy import or_, and_
    exists = db.execute(
        ar.select().where(
            or_(
                and_(ar.c.article_id == article.id, ar.c.related_id == related.id),
                and_(ar.c.article_id == related.id, ar.c.related_id == article.id)
            )
        )
    ).first()
    if exists:
        return {"status": "already_exists"}
    db.execute(ar.insert().values(article_id=article.id, related_id=related.id))
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

    # Resolve both IDs to full UUIDs
    article = _resolve_article(db, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    related = _resolve_article(db, related_id)
    if not related:
        raise HTTPException(status_code=404, detail="Related article not found")

    ar = models.article_relations
    from sqlalchemy import or_, and_
    db.execute(
        ar.delete().where(
            or_(
                and_(ar.c.article_id == article.id, ar.c.related_id == related.id),
                and_(ar.c.article_id == related.id, ar.c.related_id == article.id)
            )
        )
    )
    db.commit()
    return {"status": "unlinked"}

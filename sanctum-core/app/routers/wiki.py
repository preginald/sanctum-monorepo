from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from .. import models, schemas, auth
from ..models import Article, ArticleHistory # Ensure ArticleHistory is imported
from ..database import get_db
from uuid import UUID

router = APIRouter(tags=["Wiki"])

@router.get("/articles", response_model=List[schemas.ArticleResponse])
def get_articles(category: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Article).options(joinedload(models.Article.author))
    if category: query = query.filter(models.Article.category == category)
    articles = query.order_by(models.Article.identifier.asc()).all()
    
    # Map Author Name
    for a in articles:
        if a.author: a.author_name = a.author.full_name
        
    return articles

@router.get("/articles/{slug}", response_model=schemas.ArticleResponse)
def get_article_detail(slug: str, db: Session = Depends(get_db)):
    query = db.query(models.Article).options(joinedload(models.Article.author))
    try:
        uid = UUID(slug)
        article = query.filter(models.Article.id == uid).first()
    except ValueError:
        article = query.filter(models.Article.slug == slug).first()
        
    if not article: raise HTTPException(status_code=404, detail="Article not found")
    
    if article.author: article.author_name = article.author.full_name
    return article

@router.post("/articles", response_model=schemas.ArticleResponse)
def create_article(article: schemas.ArticleCreate, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    if current_user.role == 'client': raise HTTPException(status_code=403, detail="Forbidden")
    new_article = models.Article(**article.model_dump(), author_id=current_user.id)
    db.add(new_article)
    db.commit()
    db.refresh(new_article)
    return new_article

@router.put("/articles/{article_id}", response_model=schemas.ArticleResponse)
def update_article(
    article_id: str, 
    update: schemas.ArticleUpdate, 
    current_user: models.User = Depends(auth.get_current_active_user), # Need user for history attribution
    db: Session = Depends(get_db)
):
    article = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not article: raise HTTPException(status_code=404, detail="Article not found")
    
    # 1. SNAPSHOT CURRENT STATE (Copy-on-Write)
    # We save what it WAS before this update
    history_entry = models.ArticleHistory(
        article_id=article.id,
        author_id=article.author_id, # The person who wrote the OLD version (or current_user? Usually preserve original author credit or snapshotter. Let's use the modifier.)
        # Actually, standard logic: History record shows WHO made the change? 
        # No, History shows "This was v1.0". The *current* update is v1.1.
        # Let's save the current state as a history record.
        title=article.title,
        content=article.content,
        version=article.version
    )
    db.add(history_entry)
    
    # 2. APPLY UPDATE
    update_data = update.model_dump(exclude_unset=True)
    for key, value in update_data.items(): 
        setattr(article, key, value)
    
    # Update latest author to the person making THIS edit
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
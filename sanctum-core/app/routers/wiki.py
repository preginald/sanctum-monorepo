from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from .. import models, schemas, auth
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
def update_article(article_id: str, update: schemas.ArticleUpdate, db: Session = Depends(get_db)):
    article = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not article: raise HTTPException(status_code=404, detail="Article not found")
    update_data = update.model_dump(exclude_unset=True)
    for key, value in update_data.items(): setattr(article, key, value)
    db.commit()
    db.refresh(article)
    return article
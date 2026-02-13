"""
PHASE 62: Vendor Catalog API Router
Provides vendor search and filtering for SearchableSelect components
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app import models
from app.auth import get_current_user

router = APIRouter(prefix="/vendors", tags=["Vendors"])


@router.get("/categories")
def list_vendor_categories(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Get list of all vendor categories with counts.
    Used to populate category filters in admin.
    """
    from sqlalchemy import func
    
    categories = db.query(
        models.Vendor.category,
        func.count(models.Vendor.id).label('count')
    ).filter(
        models.Vendor.is_active == True
    ).group_by(
        models.Vendor.category
    ).all()
    
    return [
        {
            "category": cat,
            "count": count,
            "label": cat.replace('_', ' ').title()
        }
        for cat, count in categories
    ]


@router.get("/by-category/{category}")
def get_vendors_by_category(
    category: str,
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # UPDATED: Use .contains([category]) for the array column
    vendors = db.query(models.Vendor).filter(
        models.Vendor.category.contains([category]),
        models.Vendor.is_active == True
    ).order_by(models.Vendor.name).limit(limit).all()
    
    return [
        {
            "id": str(v.id),
            "name": v.name,
            "website": v.website,
            "category": v.category, # This will now return a list
            "description": v.description,
            "tags": v.tags or [],
            "risk_score": v.risk_score,     # NEW
            "is_critical": v.is_critical    # NEW
        }
        for v in vendors
    ]


@router.get("/search")
def search_vendors(
    q: str = Query(..., min_length=1),
    category: Optional[str] = None,
    tags: Optional[List[str]] = Query(None),
    limit: int = Query(20, le=50),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Search vendors across all categories or within specific category.
    
    Examples:
    - /vendors/search?q=microsoft
    - /vendors/search?q=xero&category=saas
    - /vendors/search?q=backup&tags=australian
    """
    query = db.query(models.Vendor).filter(
        models.Vendor.is_active == True,
        models.Vendor.name.ilike(f"%{q}%")
    )
    
    if category:
        # UPDATED: Use contains for array searching
        query = query.filter(models.Vendor.category.contains([category]))
    
    if tags:
        # Filter by tags (array contains)
        for tag in tags:
            query = query.filter(models.Vendor.tags.contains([tag]))
    
    vendors = query.order_by(models.Vendor.name).limit(limit).all()
    
    return [
        {
            "id": str(v.id),
            "name": v.name,
            "website": v.website,
            "category": v.category,
            "description": v.description,
            "tags": v.tags or [],
            "typical_renewal_cycle": v.typical_renewal_cycle,
            "base_price_aud": float(v.base_price_aud) if v.base_price_aud else None,
            "risk_score": v.risk_score,     # NEW
            "is_critical": v.is_critical    # NEW
        }
        for v in vendors
    ]


@router.get("/{vendor_id}")
def get_vendor(
    vendor_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get detailed vendor information"""
    vendor = db.query(models.Vendor).filter(
        models.Vendor.id == vendor_id
    ).first()
    
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    return {
        "id": str(vendor.id),
        "name": vendor.name,
        "category": vendor.category,
        "website": vendor.website,
        "support_email": vendor.support_email,
        "support_phone": vendor.support_phone,
        "description": vendor.description,
        "typical_renewal_cycle": vendor.typical_renewal_cycle,
        "typical_pricing_model": vendor.typical_pricing_model,
        "base_price_aud": float(vendor.base_price_aud) if vendor.base_price_aud else None,
        "pricing_notes": vendor.pricing_notes,
        "tags": vendor.tags or [],
        "logo_url": vendor.logo_url,
        "risk_score": vendor.risk_score,     # NEW
        "is_critical": vendor.is_critical    # NEW
    }


@router.get("/popular/{category}")
def get_popular_vendors(
    category: str,
    limit: int = Query(10, le=20),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Get popular vendors in a category (tagged with 'popular').
    Used to show suggested vendors in questionnaire.
    """
    vendors = db.query(models.Vendor).filter(
        models.Vendor.category.contains([category]),
        models.Vendor.is_active == True,
        models.Vendor.tags.contains(['popular'])
    ).order_by(models.Vendor.name).limit(limit).all()
    
    return [
        {
            "id": str(v.id),
            "name": v.name,
            "website": v.website,
            "description": v.description,
            "risk_score": v.risk_score,     # NEW
            "is_critical": v.is_critical    # NEW
        }
        for v in vendors
    ]


# ========================================
# ADMIN ENDPOINTS (Vendor Management)
# ========================================

@router.post("/", tags=["Admin"])
def create_vendor(
    vendor_data: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Admin: Create new vendor"""
    # TODO: Add admin permission check
    
    vendor = models.Vendor(
        **vendor_data
    )
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    
    return {"id": str(vendor.id), "name": vendor.name}


@router.patch("/{vendor_id}", tags=["Admin"])
def update_vendor(
    vendor_id: UUID,
    vendor_data: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Admin: Update vendor"""
    # TODO: Add admin permission check
    
    vendor = db.query(models.Vendor).filter(
        models.Vendor.id == vendor_id
    ).first()
    
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    for key, value in vendor_data.items():
        setattr(vendor, key, value)
    
    db.commit()
    
    return {"id": str(vendor.id), "name": vendor.name}
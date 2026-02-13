from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime
from .. import models
from ..database import get_db

router = APIRouter(prefix="/ingest", tags=["Ingest Agent"])

@router.post("/asset/{token}")
def ingest_client_asset(token: UUID, payload: dict, db: Session = Depends(get_db)):
    """
    Public endpoint for 'Sanctum Agent' scripts.
    Identifies client via unique token and creates a Draft Asset.
    """
    # Find account by token
    account = db.query(models.Account).filter(models.Account.ingest_token == token).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Invalid ingest token")

    # Create the Asset as a 'draft' for Admin approval
    new_asset = models.Asset(
        account_id=account.id,
        name=payload.get('name', 'Unknown Device'),
        asset_type=payload.get('asset_type', 'workstation'),
        status='draft',
        serial_number=payload.get('serial_number'),
        specs=payload.get('specs', {}), # Our new JSONB column
        notes=f"Auto-ingested via script on {datetime.now().strftime('%Y-%m-%d %H:%M')}"
    )
    
    db.add(new_asset)
    db.commit()
    db.refresh(new_asset)
    
    return {
        "status": "success", 
        "asset_id": str(new_asset.id),
        "client": account.name
    }
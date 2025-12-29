from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from datetime import timedelta

from .database import get_db
from . import models, schemas, auth

app = FastAPI(title="Sanctum Core", version="1.1.0")

# --- CORS POLICY (The Bridge) ---
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://159.223.82.75:5173", # Your Droplet IP
    "http://core.digitalsanctum.com.au",  
    "https://core.digitalsanctum.com.au", 
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# This tells FastAPI where to look for the token URL
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@app.get("/")
def read_root():
    return {"system": "Sanctum Core", "status": "operational"}

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"database": "connected"}

@app.get("/dashboard/stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(
    current_user: models.User = Depends(auth.get_current_active_user), # We need to create this dependency
    db: Session = Depends(get_db)
):
    # 1. Initialize Defaults
    revenue = 0.0
    audits = 0
    tickets = 0

    # 2. BIFURCATION LOGIC
    # If Global or Digital Sanctum (ds_only), calculate Revenue
    if current_user.access_scope in ['global', 'ds_only']:
        revenue_query = db.query(func.sum(models.Deal.amount)).scalar()
        revenue = revenue_query if revenue_query else 0.0

        audits = db.query(models.AuditReport).count()

    # If Global or Naked Tech (nt_only), calculate Tickets
    if current_user.access_scope in ['global', 'nt_only']:
        tickets = db.query(models.Ticket).filter(models.Ticket.status != 'resolved').count()

    return {
        "revenue_mtd": revenue,
        "active_audits": audits,
        "open_tickets": tickets
    }

# --- AUTHENTICATION ENDPOINT ---
@app.post("/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # 1. Fetch user by email
    user = db.query(models.User).filter(models.User.email == form_data.username).first()

    # 2. Validate User and Password
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. Generate Token
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email, "scope": user.access_scope},
        expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}

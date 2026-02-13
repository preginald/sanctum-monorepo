from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
# UPDATED IMPORTS: Added 'analytics'
from .routers import auth, system, tickets, crm, invoices, projects, campaigns, wiki, portal, comments, admin, search, sentinel, assets, automations, timesheets, analytics, notifications, vendors, ingest

app = FastAPI(title="Sanctum Core", version="1.9.1")
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# CORS
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://core.digitalsanctum.com.au",
    "https://digitalsanctum.com.au"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REGISTER ROUTERS
app.include_router(auth.router)
app.include_router(system.router)
app.include_router(crm.router)
app.include_router(tickets.router)
app.include_router(invoices.router)
app.include_router(projects.router)
app.include_router(campaigns.router)
app.include_router(wiki.router)
app.include_router(portal.router)
app.include_router(comments.router)
app.include_router(admin.router)
app.include_router(admin.account_router)  # PHASE 61A: Account management
app.include_router(ingest.router, prefix="/api")
app.include_router(search.router)
app.include_router(sentinel.router)
app.include_router(assets.router)
app.include_router(automations.router)
app.include_router(timesheets.router)

# NEW REGISTRATION
app.include_router(analytics.router)
app.include_router(notifications.router)
app.include_router(vendors.router)

# ROOT HEALTH CHECK
@app.get("/")
def read_root():
    return {"status": "operational", "system": "Sanctum Core v1.9.1"}
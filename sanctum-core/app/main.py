from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from .routers import auth, system, tickets, crm, invoices, projects, campaigns, wiki, portal, comments, admin, search, sentinel, assets
from .services.event_bus import event_bus
from .services import listeners

app = FastAPI(title="Sanctum Core", version="1.9.0")
app.mount("/static", StaticFiles(directory="app/static"), name="static")

@app.on_event("startup")
def configure_event_bus():
    # Register Listeners
    event_bus.subscribe("ticket_created", listeners.on_ticket_created)
    event_bus.subscribe("ticket_resolved", listeners.on_ticket_resolved)

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
app.include_router(search.router)
app.include_router(sentinel.router)
app.include_router(assets.router)




# ROOT HEALTH CHECK (Simple)
@app.get("/")
def read_root():
    return {"status": "operational", "system": "Sanctum Core v1.9.0"}
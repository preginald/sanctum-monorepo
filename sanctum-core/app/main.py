import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from .cors import CORS_ORIGIN_REGEX
# UPDATED IMPORTS: Added 'analytics'
from .routers import auth, system, tickets, crm, invoices, projects, campaigns, wiki, portal, comments, admin, search, sentinel, assets, automations, timesheets, analytics, notifications, vendors, ingest, api_tokens, templates, artefacts, mcp_telemetry, sso, workbench

app = FastAPI(title="Sanctum Core", version="1.9.1", root_path=os.getenv("ROOT_PATH", ""))
app.mount("/static", StaticFiles(directory="app/static"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=CORS_ORIGIN_REGEX,
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
app.include_router(admin.service_router)  # #643: Service health/restart
app.include_router(ingest.router)
app.include_router(search.router)
app.include_router(sentinel.router)
app.include_router(assets.router)
app.include_router(automations.router)
app.include_router(timesheets.router)

# NEW REGISTRATION
app.include_router(analytics.router)
app.include_router(notifications.router)
app.include_router(vendors.router)
app.include_router(api_tokens.router)
app.include_router(templates.router)
app.include_router(artefacts.router)
app.include_router(mcp_telemetry.router)
app.include_router(sso.router)
app.include_router(workbench.router)

# EVENT SUBSCRIBERS
from .services.event_bus import event_bus
from .services.audit_subscriber import handle_template_applied
event_bus.subscribe("template_applied", handle_template_applied)

from .services.workbench_subscriber import handle_workbench_ticket_event
event_bus.subscribe("ticket_status_change", handle_workbench_ticket_event)
event_bus.subscribe("ticket_comment", handle_workbench_ticket_event)

# ROOT HEALTH CHECK
@app.get("/")
def read_root():
    return {"status": "operational", "system": "Sanctum Core v1.9.1"}

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from .. import models, schemas, auth
from ..database import get_db
import time
import psutil
import subprocess
import os
from datetime import datetime

router = APIRouter(tags=["System"])

@router.get("/system/health")
def run_system_diagnostics(db: Session = Depends(get_db)):
    start_time = time.time()
    
    # Git Version
    try:
        cwd = os.path.dirname(os.path.abspath(__file__))
        parent = os.path.dirname(os.path.dirname(cwd)) 
        commit = subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD'], cwd=parent, stderr=subprocess.DEVNULL).strip().decode('utf-8')
    except:
        commit = "UNKNOWN"

    report = {
        "timestamp": datetime.now(),
        "version": commit,
        "status": "nominal",
        "system": {},
        "database": {"latency_ms": 0},
        "checks": []
    }
    
    def add_check(name, status, message="", latency_ms=0):
        report["checks"].append({"name": name, "status": status, "message": message, "latency": f"{latency_ms:.2f}ms" if latency_ms > 0 else None})
        if status == "error": report["status"] = "critical"
        elif status == "warning" and report["status"] != "critical": report["status"] = "degraded"

    # System Vitals
    try:
        du = psutil.disk_usage('/')
        mem = psutil.virtual_memory()
        report["system"] = {
            "cpu_percent": psutil.cpu_percent(),
            "memory_percent": mem.percent,
            "disk_percent": du.percent,
            "disk_free_gb": round(du.free / (1024**3), 2)
        }
        if du.percent > 90: add_check("Storage", "warning", "Disk Space Low")
        else: add_check("Storage", "ok", f"{report['system']['disk_free_gb']}GB Free")
    except Exception as e:
        report["system"] = {"cpu_percent": 0}
        add_check("System Metrics", "error", str(e))

    # Database Latency
    try:
        t0 = time.time()
        db.execute(text("SELECT 1"))
        t1 = time.time()
        latency = (t1 - t0) * 1000
        report["database"]["latency_ms"] = round(latency, 2)
        status = "ok"
        if latency > 100: status = "warning"
        if latency > 500: status = "error"
        add_check("Database Ping", status, "Connected", latency)
    except Exception as e:
        report["database"]["latency_ms"] = -1
        add_check("Database Ping", "error", str(e))

    # Schema Integrity
    required_tables = [(models.User, "Users"), (models.Ticket, "Tickets"), (models.Invoice, "Invoices"), (models.Article, "Wiki")]
    for model, name in required_tables:
        try:
            count = db.query(model).count()
            add_check(f"Table: {name}", "ok", f"{count} records")
        except Exception as e:
            add_check(f"Table: {name}", "error", "Missing/Corrupt")

    report["execution_time_ms"] = round((time.time() - start_time) * 1000, 2)
    return report

@router.get("/dashboard/stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    revenue_realized = 0.0
    pipeline_value = 0.0
    active_audits = 0
    open_tickets = 0
    critical_tickets = 0

    try:
        if current_user.access_scope in ['global', 'ds_only']:
            rev_q = db.query(func.sum(models.Deal.amount)).filter(models.Deal.stage == 'Accession').scalar()
            revenue_realized = float(rev_q) if rev_q else 0.0
            pipe_q = db.query(func.sum(models.Deal.amount)).filter(models.Deal.stage != 'Accession').filter(models.Deal.stage != 'Lost').scalar()
            pipeline_value = float(pipe_q) if pipe_q else 0.0
            active_audits = db.query(models.AuditReport).filter(models.AuditReport.status == 'draft').count()

        if current_user.access_scope in ['global', 'nt_only']:
            open_tickets = db.query(models.Ticket).filter(models.Ticket.status != 'resolved').count()
            critical_tickets = db.query(models.Ticket).filter(models.Ticket.status != 'resolved').filter(models.Ticket.priority == 'critical').count()

    except Exception as e:
        print(f"DASHBOARD ERROR: {str(e)}")
        
    return {
        "revenue_realized": revenue_realized,
        "pipeline_value": pipeline_value,
        "active_audits": active_audits,
        "open_tickets": open_tickets,
        "critical_tickets": critical_tickets
    }
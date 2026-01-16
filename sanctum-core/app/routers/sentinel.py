from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import socket
import ssl
import requests
import dns.resolver
from datetime import datetime
from .. import schemas

router = APIRouter(prefix="/sentinel", tags=["Sentinel"])

class ScanRequest(BaseModel):
    domain: str

@router.post("/scan", response_model=list[schemas.AuditItem])
def run_sentinel_scan(payload: ScanRequest):
    domain = payload.domain.replace("https://", "").replace("http://", "").strip("/")
    audit_items = []

    # 1. SSL/TLS CHECK
    try:
        context = ssl.create_default_context()
        with socket.create_connection((domain, 443), timeout=5) as sock:
            with context.wrap_socket(sock, server_hostname=domain) as ssock:
                cert = ssock.getpeercert()
                not_after = datetime.strptime(cert['notAfter'], '%b %d %H:%M:%S %Y %Z')
                days_left = (not_after - datetime.now()).days
                
                status = "Green" if days_left > 30 else "Amber"
                if days_left < 0: status = "Red"
                
                audit_items.append({
                    "category": "Encryption",
                    "item": "SSL Certificate Expiry",
                    "status": status,
                    "comment": f"Expires in {days_left} days ({not_after.strftime('%Y-%m-%d')}). Issuer: {cert['issuer'][1][0][1]}"
                })
    except Exception as e:
        audit_items.append({
            "category": "Encryption", "item": "SSL Connectivity", "status": "Red", "comment": f"Failed to connect: {str(e)}"
        })

    # 2. HTTP HEADERS (Security Headers)
    try:
        r = requests.get(f"https://{domain}", timeout=5)
        headers = r.headers
        
        # HSTS
        if 'Strict-Transport-Security' in headers:
            audit_items.append({"category": "Headers", "item": "HSTS Enforced", "status": "Green", "comment": "Strict-Transport-Security header is present."})
        else:
            audit_items.append({"category": "Headers", "item": "HSTS Missing", "status": "Amber", "comment": "Site allows downgrade attacks."})
            
        # X-Frame-Options
        if 'X-Frame-Options' in headers:
            audit_items.append({"category": "Headers", "item": "Clickjacking Protection", "status": "Green", "comment": "X-Frame-Options present."})
        else:
            audit_items.append({"category": "Headers", "item": "Clickjacking Risk", "status": "Amber", "comment": "X-Frame-Options missing."})
            
        # Server Disclosure
        if 'Server' in headers:
            audit_items.append({"category": "Information", "item": "Server Disclosure", "status": "Amber", "comment": f"Server banner revealed: {headers['Server']}"})
            
    except Exception as e:
        audit_items.append({"category": "Availability", "item": "Website Reachability", "status": "Red", "comment": "Could not reach HTTPS endpoint."})

    # 3. DNS RECORDS (Email Security)
    try:
        mx_records = dns.resolver.resolve(domain, 'MX')
        mx_list = [str(r.exchange).rstrip('.') for r in mx_records]
        audit_items.append({
            "category": "DNS", 
            "item": "MX Records", 
            "status": "Green", 
            "comment": f"Mail handled by: {', '.join(mx_list)}"
        })
        
        # SPF Check (TXT)
        txt_records = dns.resolver.resolve(domain, 'TXT')
        spf_found = False
        for r in txt_records:
            if "v=spf1" in str(r):
                spf_found = True
                audit_items.append({"category": "DNS", "item": "SPF Record", "status": "Green", "comment": "SPF record found."})
        
        if not spf_found:
            audit_items.append({"category": "DNS", "item": "SPF Record", "status": "Red", "comment": "Missing SPF record (Spoofing risk)."})

    except Exception:
        audit_items.append({"category": "DNS", "item": "DNS Resolution", "status": "Red", "comment": "Failed to resolve DNS records."})

    return audit_items

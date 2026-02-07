import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import AuditTemplate, Base
from app.database import SQLALCHEMY_DATABASE_URL

# Setup DB Connection
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

ESSENTIAL_8_TEMPLATE = {
    "name": "Essential 8 Maturity Model",
    "framework": "Essential8",
    "category": "security",
    "description": "Australian Cyber Security Centre (ACSC) Essential Eight security controls for threat mitigation.",
    "category_structure": [
        {
            "category": "Mitigation Strategy 1: Application Control",
            "controls": [
                {"id": "e8_app_01", "name": "Application control is implemented on workstations", "weight": 1},
                {"id": "e8_app_02", "name": "Application control is implemented on servers", "weight": 1},
                {"id": "e8_app_03", "name": "Allowed applications are validated using digital signatures or hash values", "weight": 1}
            ]
        },
        {
            "category": "Mitigation Strategy 2: Patch Applications",
            "controls": [
                {"id": "e8_patch_01", "name": "Security vulnerabilities in applications are patched within 48 hours (extreme risk)", "weight": 2},
                {"id": "e8_patch_02", "name": "Security vulnerabilities in applications are patched within two weeks (high risk)", "weight": 1},
                {"id": "e8_patch_03", "name": "Latest application versions are used", "weight": 1}
            ]
        },
        {
            "category": "Mitigation Strategy 3: Configure Microsoft Office Macro Settings",
            "controls": [
                {"id": "e8_macro_01", "name": "Microsoft Office macros are disabled for files from the internet", "weight": 1},
                {"id": "e8_macro_02", "name": "Microsoft Office macros in files from trusted locations are subject to validation", "weight": 1},
                {"id": "e8_macro_03", "name": "Only privileged users can enable macros for specific files after security review", "weight": 1}
            ]
        },
        {
            "category": "Mitigation Strategy 4: User Application Hardening",
            "controls": [
                {"id": "e8_hard_01", "name": "Web browsers are configured to block or disable support for Flash Player content", "weight": 1},
                {"id": "e8_hard_02", "name": "Web browsers are configured to block web advertisements", "weight": 1},
                {"id": "e8_hard_03", "name": "Web browsers are configured to block Java from the internet", "weight": 1}
            ]
        },
        {
            "category": "Mitigation Strategy 5: Restrict Administrative Privileges",
            "controls": [
                {"id": "e8_admin_01", "name": "Administrative privileges are restricted to a separate privileged access workstation", "weight": 2},
                {"id": "e8_admin_02", "name": "Privileged accounts cannot access the internet or email", "weight": 2},
                {"id": "e8_admin_03", "name": "Just-in-time administration is used for privileged tasks", "weight": 1}
            ]
        },
        {
            "category": "Mitigation Strategy 6: Patch Operating Systems",
            "controls": [
                {"id": "e8_os_01", "name": "Security vulnerabilities in operating systems are patched within 48 hours (extreme risk)", "weight": 2},
                {"id": "e8_os_02", "name": "Security vulnerabilities in operating systems are patched within two weeks (high risk)", "weight": 1},
                {"id": "e8_os_03", "name": "Latest operating system versions are used", "weight": 1}
            ]
        },
        {
            "category": "Mitigation Strategy 7: Multi-Factor Authentication",
            "controls": [
                {"id": "e8_mfa_01", "name": "MFA is used for authenticating all users to their organization's systems", "weight": 3},
                {"id": "e8_mfa_02", "name": "MFA is used for privileged users and any remote access", "weight": 3},
                {"id": "e8_mfa_03", "name": "MFA uses phishing-resistant methods (FIDO2, smart cards)", "weight": 2}
            ]
        },
        {
            "category": "Mitigation Strategy 8: Regular Backups",
            "controls": [
                {"id": "e8_backup_01", "name": "Backups are performed daily for critical data", "weight": 2},
                {"id": "e8_backup_02", "name": "Backups are stored offline or in an immutable state", "weight": 3},
                {"id": "e8_backup_03", "name": "Backup restoration is tested at least quarterly", "weight": 2}
            ]
        }
    ],
    "is_active": True
}

NIST_CSF_LITE = {
    "name": "NIST Cybersecurity Framework (Lite)",
    "framework": "NIST-CSF",
    "category": "security",
    "description": "Simplified NIST CSF assessment covering Identify, Protect, Detect, Respond, Recover functions.",
    "category_structure": [
        {
            "category": "Identify: Asset Management",
            "controls": [
                {"id": "nist_id_01", "name": "Physical devices and systems are inventoried", "weight": 1},
                {"id": "nist_id_02", "name": "Software platforms and applications are inventoried", "weight": 1},
                {"id": "nist_id_03", "name": "Business functions and critical dependencies are documented", "weight": 1}
            ]
        },
        {
            "category": "Protect: Access Control",
            "controls": [
                {"id": "nist_pr_01", "name": "Identities are managed for authorized users and devices", "weight": 2},
                {"id": "nist_pr_02", "name": "Physical access to assets is managed and protected", "weight": 1},
                {"id": "nist_pr_03", "name": "Remote access is managed with MFA", "weight": 2}
            ]
        },
        {
            "category": "Detect: Security Monitoring",
            "controls": [
                {"id": "nist_de_01", "name": "Networks and systems are monitored for anomalous activity", "weight": 2},
                {"id": "nist_de_02", "name": "Security events are logged and analyzed", "weight": 2},
                {"id": "nist_de_03", "name": "Security alerts are generated for detected events", "weight": 1}
            ]
        },
        {
            "category": "Respond: Incident Response",
            "controls": [
                {"id": "nist_rs_01", "name": "Incident response plan is documented and tested", "weight": 2},
                {"id": "nist_rs_02", "name": "Incidents are analyzed and contained", "weight": 2},
                {"id": "nist_rs_03", "name": "Lessons learned are incorporated post-incident", "weight": 1}
            ]
        },
        {
            "category": "Recover: Recovery Planning",
            "controls": [
                {"id": "nist_rc_01", "name": "Recovery processes are executed during/after incidents", "weight": 2},
                {"id": "nist_rc_02", "name": "Improvements are made based on recovery activities", "weight": 1}
            ]
        }
    ],
    "is_active": True
}

DEFAULT_TEMPLATES = [ESSENTIAL_8_TEMPLATE, NIST_CSF_LITE]

def seed():
    db = SessionLocal()
    print("🌱 Seeding Audit Templates...")
    
    try:
        for template_def in DEFAULT_TEMPLATES:
            exists = db.query(AuditTemplate).filter(
                AuditTemplate.framework == template_def['framework']
            ).first()
            
            if not exists:
                print(f"   Creating template: {template_def['name']}")
                template = AuditTemplate(**template_def)
                db.add(template)
            else:
                print(f"   Skipping template (exists): {template_def['name']}")
        
        db.commit()
        print("✅ Audit Template Seeding Complete.")
        
    except Exception as e:
        print(f"❌ Error seeding audit templates: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()

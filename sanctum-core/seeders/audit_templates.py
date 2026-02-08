import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import AuditTemplate, Base
from app.database import SQLALCHEMY_DATABASE_URL

# Setup DB Connection
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ============================================================================
# CATEGORY 1: SECURITY & COMPLIANCE
# ============================================================================

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

# ============================================================================
# CATEGORY 2: INFRASTRUCTURE HEALTH
# ============================================================================

INFRASTRUCTURE_HEALTH = {
    "name": "Infrastructure Health Assessment",
    "framework": "INFRASTRUCTURE",
    "category": "infrastructure",
    "description": "Comprehensive evaluation of server, network, and capacity management practices.",
    "category_structure": [
        {
            "category": "Server & Network Uptime",
            "controls": [
                {"id": "infra_up_01", "name": "Critical servers meet 99.9% uptime SLA", "weight": 3},
                {"id": "infra_up_02", "name": "Network infrastructure is redundant (no single points of failure)", "weight": 2},
                {"id": "infra_up_03", "name": "Server monitoring alerts are configured and tested", "weight": 1}
            ]
        },
        {
            "category": "Patch & Firmware Management",
            "controls": [
                {"id": "infra_patch_01", "name": "Operating systems are patched within SLA requirements", "weight": 2},
                {"id": "infra_patch_02", "name": "Firmware updates are applied to network devices and storage", "weight": 1},
                {"id": "infra_patch_03", "name": "Patch deployment is tested in non-production environments first", "weight": 1}
            ]
        },
        {
            "category": "Backup & Recovery",
            "controls": [
                {"id": "infra_backup_01", "name": "Backups are performed daily and verified for integrity", "weight": 3},
                {"id": "infra_backup_02", "name": "Recovery testing is conducted at least quarterly", "weight": 2},
                {"id": "infra_backup_03", "name": "Backup retention policies meet regulatory requirements", "weight": 1}
            ]
        },
        {
            "category": "Capacity Planning",
            "controls": [
                {"id": "infra_cap_01", "name": "Storage capacity is monitored with automated alerts for 80% threshold", "weight": 1},
                {"id": "infra_cap_02", "name": "CPU and memory utilization trends are reviewed monthly", "weight": 1},
                {"id": "infra_cap_03", "name": "Growth forecasting informs infrastructure refresh planning", "weight": 1}
            ]
        }
    ],
    "is_active": True
}

# ============================================================================
# CATEGORY 3: DIGITAL PRESENCE
# ============================================================================

DIGITAL_PRESENCE = {
    "name": "Digital Presence Assessment",
    "framework": "DIGITAL",
    "category": "digital",
    "description": "Evaluation of website performance, SEO fundamentals, and domain/SSL health.",
    "category_structure": [
        {
            "category": "Website Performance",
            "controls": [
                {"id": "digital_perf_01", "name": "Website achieves Google Core Web Vitals 'Good' rating", "weight": 2},
                {"id": "digital_perf_02", "name": "Page load time is under 3 seconds on desktop and mobile", "weight": 2},
                {"id": "digital_perf_03", "name": "Images are optimized and served in modern formats (WebP, AVIF)", "weight": 1}
            ]
        },
        {
            "category": "SEO Fundamentals",
            "controls": [
                {"id": "digital_seo_01", "name": "All pages have unique, descriptive title tags and meta descriptions", "weight": 1},
                {"id": "digital_seo_02", "name": "XML sitemap is present and submitted to search engines", "weight": 1},
                {"id": "digital_seo_03", "name": "Schema.org structured data is implemented for key content", "weight": 1},
                {"id": "digital_seo_04", "name": "Website has no broken links or 404 errors on key pages", "weight": 1}
            ]
        },
        {
            "category": "Security & Domain Health",
            "controls": [
                {"id": "digital_ssl_01", "name": "SSL/TLS certificate is valid and properly configured", "weight": 2},
                {"id": "digital_ssl_02", "name": "Domain name has at least 6 months until expiry", "weight": 1},
                {"id": "digital_dns_01", "name": "DNS records include SPF, DKIM, and DMARC for email security", "weight": 1},
                {"id": "digital_dns_02", "name": "DNS is hosted with a reliable provider with redundancy", "weight": 1}
            ]
        }
    ],
    "is_active": True
}

# ============================================================================
# CATEGORY 4: OPERATIONAL EFFICIENCY
# ============================================================================

OPERATIONAL_EFFICIENCY = {
    "name": "Operational Efficiency Assessment",
    "framework": "EFFICIENCY",
    "category": "efficiency",
    "description": "Analysis of software license utilization, SaaS sprawl, and cost optimization opportunities.",
    "category_structure": [
        {
            "category": "License & SaaS Management",
            "controls": [
                {"id": "eff_lic_01", "name": "Software license inventory is maintained and up to date", "weight": 1},
                {"id": "eff_lic_02", "name": "License utilization is tracked and unused licenses are reclaimed", "weight": 2},
                {"id": "eff_lic_03", "name": "SaaS subscriptions are reviewed quarterly for redundancy", "weight": 2}
            ]
        },
        {
            "category": "Cost Optimization",
            "controls": [
                {"id": "eff_cost_01", "name": "Cloud/SaaS spending is monitored with budget alerts", "weight": 1},
                {"id": "eff_cost_02", "name": "Vendor contracts are reviewed annually for better pricing", "weight": 1},
                {"id": "eff_cost_03", "name": "Opportunities for consolidation are identified and actioned", "weight": 1}
            ]
        },
        {
            "category": "Microsoft 365 Optimization",
            "controls": [
                {"id": "eff_m365_01", "name": "M365 features are utilized effectively (Teams, SharePoint, OneDrive)", "weight": 1},
                {"id": "eff_m365_02", "name": "License tiers match user requirements (no over-licensing)", "weight": 1},
                {"id": "eff_m365_03", "name": "Retention policies and archiving are configured appropriately", "weight": 1}
            ]
        },
        {
            "category": "Automation Coverage",
            "controls": [
                {"id": "eff_auto_01", "name": "Repetitive manual tasks are identified for automation", "weight": 1}
            ]
        }
    ],
    "is_active": True
}

# ============================================================================
# CATEGORY 5: BUSINESS CONTINUITY
# ============================================================================

BUSINESS_CONTINUITY = {
    "name": "Business Continuity & Resilience Assessment",
    "framework": "CONTINUITY",
    "category": "continuity",
    "description": "Evaluation of disaster recovery preparedness, incident response, and operational resilience.",
    "category_structure": [
        {
            "category": "Disaster Recovery Planning",
            "controls": [
                {"id": "cont_dr_01", "name": "Documented disaster recovery plan exists and is current", "weight": 3},
                {"id": "cont_dr_02", "name": "Recovery Time Objectives (RTO) are defined for critical systems", "weight": 2},
                {"id": "cont_dr_03", "name": "Recovery Point Objectives (RPO) are defined and met", "weight": 2},
                {"id": "cont_dr_04", "name": "DR plan is tested at least annually with documented results", "weight": 3}
            ]
        },
        {
            "category": "Incident Response",
            "controls": [
                {"id": "cont_ir_01", "name": "Incident response runbooks are documented and accessible", "weight": 2},
                {"id": "cont_ir_02", "name": "Contact lists for escalation are maintained and current", "weight": 1},
                {"id": "cont_ir_03", "name": "Post-incident reviews are conducted to capture lessons learned", "weight": 1}
            ]
        },
        {
            "category": "Alternative Operations",
            "controls": [
                {"id": "cont_alt_01", "name": "Alternative workspace arrangements are defined (work-from-home, backup office)", "weight": 1},
                {"id": "cont_alt_02", "name": "Communication plan exists for notifying staff during incidents", "weight": 2},
                {"id": "cont_alt_03", "name": "Critical business processes can continue during disruptions", "weight": 2}
            ]
        }
    ],
    "is_active": True
}

# ============================================================================
# CATEGORY 6: USER EXPERIENCE
# ============================================================================

USER_EXPERIENCE = {
    "name": "User Experience & Support Quality Assessment",
    "framework": "UX",
    "category": "ux",
    "description": "Measurement of help desk performance, user satisfaction, and knowledge enablement.",
    "category_structure": [
        {
            "category": "Support Performance",
            "controls": [
                {"id": "ux_supp_01", "name": "Ticket response SLA is met for 90%+ of incidents", "weight": 2},
                {"id": "ux_supp_02", "name": "Ticket resolution SLA is met for 85%+ of incidents", "weight": 2},
                {"id": "ux_supp_03", "name": "Critical incidents are resolved within 4 hours", "weight": 3}
            ]
        },
        {
            "category": "User Satisfaction",
            "controls": [
                {"id": "ux_sat_01", "name": "Customer satisfaction surveys are conducted regularly", "weight": 1},
                {"id": "ux_sat_02", "name": "Average satisfaction score is 4.0/5.0 or higher", "weight": 2},
                {"id": "ux_sat_03", "name": "Negative feedback is reviewed and actioned", "weight": 1}
            ]
        },
        {
            "category": "Knowledge Enablement",
            "controls": [
                {"id": "ux_kb_01", "name": "Knowledge base exists and is accessible to users", "weight": 1},
                {"id": "ux_kb_02", "name": "Common issues are documented with self-service guides", "weight": 1},
                {"id": "ux_kb_03", "name": "User training programs are delivered at onboarding and annually", "weight": 1}
            ]
        },
        {
            "category": "Portal Adoption",
            "controls": [
                {"id": "ux_port_01", "name": "Client portal is available and actively used", "weight": 1}
            ]
        }
    ],
    "is_active": True
}

# ============================================================================
# MASTER TEMPLATE LIST
# ============================================================================

DEFAULT_TEMPLATES = [
    ESSENTIAL_8_TEMPLATE,
    NIST_CSF_LITE,
    INFRASTRUCTURE_HEALTH,
    DIGITAL_PRESENCE,
    OPERATIONAL_EFFICIENCY,
    BUSINESS_CONTINUITY,
    USER_EXPERIENCE
]

def seed():
    db = SessionLocal()
    print("🌱 Seeding Audit Templates (All 6 Categories)...")
    
    try:
        for template_def in DEFAULT_TEMPLATES:
            exists = db.query(AuditTemplate).filter(
                AuditTemplate.framework == template_def['framework']
            ).first()
            
            if not exists:
                print(f"   ✅ Creating template: {template_def['name']}")
                template = AuditTemplate(**template_def)
                db.add(template)
            else:
                print(f"   ⏭️  Skipping template (exists): {template_def['name']}")
        
        db.commit()
        print("✅ Audit Template Seeding Complete (7 templates across 6 categories).")
        
    except Exception as e:
        print(f"❌ Error seeding audit templates: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()
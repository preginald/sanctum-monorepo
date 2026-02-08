import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Product
from app.database import SQLALCHEMY_DATABASE_URL

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ============================================================================
# CATEGORY 1: SECURITY & COMPLIANCE PRODUCTS
# ============================================================================

SECURITY_PRODUCTS = [
    # ESSENTIAL 8: APPLICATION CONTROL
    {
        "name": "Application Whitelisting Implementation",
        "description": "Deploy and configure application control (AppLocker/WDAC) on workstations and servers",
        "type": "service",
        "unit_price": "2500.00",
        "is_recurring": False
    },
    
    # ESSENTIAL 8: PATCH MANAGEMENT
    {
        "name": "Patch Management Service (Monthly)",
        "description": "Automated patch deployment for applications and operating systems",
        "type": "service",
        "unit_price": "350.00",
        "is_recurring": True,
        "billing_frequency": "monthly"
    },
    {
        "name": "Emergency Patch Deployment",
        "description": "Expedited patching for critical vulnerabilities (48-hour SLA)",
        "type": "service",
        "unit_price": "800.00",
        "is_recurring": False
    },
    
    # ESSENTIAL 8: MFA
    {
        "name": "Multi-Factor Authentication Setup",
        "description": "Deploy MFA across all user accounts (Microsoft Authenticator / Duo)",
        "type": "service",
        "unit_price": "1500.00",
        "is_recurring": False
    },
    {
        "name": "FIDO2 Security Key (YubiKey 5 NFC)",
        "description": "Phishing-resistant hardware authentication token",
        "type": "hardware",
        "unit_price": "95.00",
        "is_recurring": False
    },
    
    # ESSENTIAL 8: MACRO SETTINGS
    {
        "name": "Microsoft Office Hardening Service",
        "description": "Configure macro security policies and trusted locations via GPO",
        "type": "service",
        "unit_price": "600.00",
        "is_recurring": False
    },
    
    # ESSENTIAL 8: USER APPLICATION HARDENING
    {
        "name": "Browser Security Hardening",
        "description": "Deploy ad-blocking, disable Flash/Java, configure security extensions",
        "type": "service",
        "unit_price": "450.00",
        "is_recurring": False
    },
    
    # ESSENTIAL 8: PRIVILEGED ACCESS
    {
        "name": "Privileged Access Workstation (PAW) Setup",
        "description": "Deploy dedicated admin workstation with restricted internet access",
        "type": "service",
        "unit_price": "3500.00",
        "is_recurring": False
    },
    {
        "name": "Just-In-Time (JIT) Admin Access Implementation",
        "description": "Configure Azure AD PIM or equivalent for temporary privilege elevation",
        "type": "service",
        "unit_price": "2000.00",
        "is_recurring": False
    },
    
    # ESSENTIAL 8: BACKUPS
    {
        "name": "Immutable Backup Solution (Monthly)",
        "description": "Cloud backup with ransomware protection and versioning",
        "type": "service",
        "unit_price": "450.00",
        "is_recurring": True,
        "billing_frequency": "monthly"
    },
    {
        "name": "Backup Restoration Testing Service",
        "description": "Quarterly disaster recovery drill and restoration verification",
        "type": "service",
        "unit_price": "900.00",
        "is_recurring": False
    },
    
    # GENERAL SECURITY
    {
        "name": "Security Awareness Training (per user/year)",
        "description": "Annual cybersecurity training program with phishing simulation",
        "type": "service",
        "unit_price": "120.00",
        "is_recurring": True,
        "billing_frequency": "yearly"
    },
    {
        "name": "Endpoint Detection & Response (EDR) License",
        "description": "Per-endpoint monthly license for advanced threat detection",
        "type": "license",
        "unit_price": "15.00",
        "is_recurring": True,
        "billing_frequency": "monthly"
    }
]

# ============================================================================
# CATEGORY 2: INFRASTRUCTURE HEALTH PRODUCTS
# ============================================================================

INFRASTRUCTURE_PRODUCTS = [
    {
        "name": "Server Monitoring Solution (Monthly)",
        "description": "24/7 server health monitoring with alert management",
        "type": "service",
        "unit_price": "250.00",
        "is_recurring": True,
        "billing_frequency": "monthly"
    },
    {
        "name": "Network Redundancy Implementation",
        "description": "Eliminate single points of failure with failover configuration",
        "type": "service",
        "unit_price": "6000.00",
        "is_recurring": False
    },
    {
        "name": "Server Hardware Refresh (per unit)",
        "description": "New server hardware with migration and configuration",
        "type": "hardware",
        "unit_price": "3500.00",
        "is_recurring": False
    },
    {
        "name": "Hypervisor Migration Service",
        "description": "Migrate workloads to modern virtualization platform",
        "type": "service",
        "unit_price": "4500.00",
        "is_recurring": False
    },
    {
        "name": "Firmware Update & Maintenance Service",
        "description": "Quarterly firmware updates for network and storage devices",
        "type": "service",
        "unit_price": "400.00",
        "is_recurring": False
    },
    {
        "name": "Backup Infrastructure Upgrade",
        "description": "Enhanced backup solution with faster recovery capabilities",
        "type": "service",
        "unit_price": "3500.00",
        "is_recurring": False
    },
    {
        "name": "Storage Capacity Planning Service",
        "description": "12-month growth forecasting and capacity recommendations",
        "type": "service",
        "unit_price": "800.00",
        "is_recurring": False
    },
    {
        "name": "Infrastructure Health Report (Quarterly)",
        "description": "Comprehensive infrastructure assessment and recommendations",
        "type": "service",
        "unit_price": "600.00",
        "is_recurring": True,
        "billing_frequency": "quarterly"
    }
]

# ============================================================================
# CATEGORY 3: DIGITAL PRESENCE PRODUCTS
# ============================================================================

DIGITAL_PRODUCTS = [
    {
        "name": "SEO Audit & Strategy Report",
        "description": "Comprehensive SEO analysis with actionable recommendations",
        "type": "service",
        "unit_price": "1200.00",
        "is_recurring": False
    },
    {
        "name": "Website Performance Optimization",
        "description": "Core Web Vitals optimization and speed improvements",
        "type": "service",
        "unit_price": "2800.00",
        "is_recurring": False
    },
    {
        "name": "Image Optimization Service",
        "description": "Convert and optimize images to modern formats (WebP/AVIF)",
        "type": "service",
        "unit_price": "450.00",
        "is_recurring": False
    },
    {
        "name": "SEO Metadata Implementation",
        "description": "Optimize title tags, meta descriptions, and structured data",
        "type": "service",
        "unit_price": "900.00",
        "is_recurring": False
    },
    {
        "name": "XML Sitemap & Search Console Setup",
        "description": "Generate and submit sitemaps to Google/Bing",
        "type": "service",
        "unit_price": "300.00",
        "is_recurring": False
    },
    {
        "name": "Schema Markup Implementation",
        "description": "Add structured data for rich search results",
        "type": "service",
        "unit_price": "700.00",
        "is_recurring": False
    },
    {
        "name": "Broken Link Audit & Repair",
        "description": "Identify and fix 404 errors and broken links",
        "type": "service",
        "unit_price": "400.00",
        "is_recurring": False
    },
    {
        "name": "SSL Certificate Management (Yearly)",
        "description": "SSL/TLS certificate provisioning and renewal",
        "type": "hosting",
        "unit_price": "150.00",
        "is_recurring": True,
        "billing_frequency": "yearly"
    },
    {
        "name": "Domain Registration & Management (Yearly)",
        "description": "Domain registration with auto-renewal protection",
        "type": "hosting",
        "unit_price": "45.00",
        "is_recurring": True,
        "billing_frequency": "yearly"
    },
    {
        "name": "DNS Security Hardening",
        "description": "Configure SPF, DKIM, DMARC, and DNSSEC",
        "type": "service",
        "unit_price": "600.00",
        "is_recurring": False
    },
    {
        "name": "Premium DNS Hosting (Monthly)",
        "description": "Enterprise DNS with 100% uptime SLA and redundancy",
        "type": "hosting",
        "unit_price": "25.00",
        "is_recurring": True,
        "billing_frequency": "monthly"
    }
]

# ============================================================================
# CATEGORY 4: OPERATIONAL EFFICIENCY PRODUCTS
# ============================================================================

EFFICIENCY_PRODUCTS = [
    {
        "name": "Software License Audit",
        "description": "Complete inventory and utilization analysis of all licenses",
        "type": "service",
        "unit_price": "1100.00",
        "is_recurring": False
    },
    {
        "name": "SaaS Optimization Review",
        "description": "Identify redundant subscriptions and consolidation opportunities",
        "type": "service",
        "unit_price": "1500.00",
        "is_recurring": False
    },
    {
        "name": "Microsoft 365 License Optimization",
        "description": "Right-size M365 licenses and reduce over-licensing",
        "type": "service",
        "unit_price": "800.00",
        "is_recurring": False
    },
    {
        "name": "Cloud Cost Optimization Service",
        "description": "Azure/AWS cost analysis and reduction strategies",
        "type": "service",
        "unit_price": "1800.00",
        "is_recurring": False
    },
    {
        "name": "Vendor Contract Negotiation Support",
        "description": "Assist with renewals to secure better pricing",
        "type": "service",
        "unit_price": "600.00",
        "is_recurring": False
    },
    {
        "name": "M365 Feature Enablement Workshop",
        "description": "Training on Teams, SharePoint, and Power Platform",
        "type": "service",
        "unit_price": "1200.00",
        "is_recurring": False
    },
    {
        "name": "Retention Policy Configuration",
        "description": "Set up M365 archiving and compliance retention",
        "type": "service",
        "unit_price": "700.00",
        "is_recurring": False
    },
    {
        "name": "Power Automate Workflow Development",
        "description": "Custom automation for repetitive business processes",
        "type": "service",
        "unit_price": "1200.00",
        "is_recurring": False
    },
    {
        "name": "Process Automation Assessment",
        "description": "Identify manual tasks suitable for automation",
        "type": "service",
        "unit_price": "900.00",
        "is_recurring": False
    }
]

# ============================================================================
# CATEGORY 5: BUSINESS CONTINUITY PRODUCTS
# ============================================================================

CONTINUITY_PRODUCTS = [
    {
        "name": "Disaster Recovery Plan Development",
        "description": "Comprehensive DR documentation with RTO/RPO definitions",
        "type": "service",
        "unit_price": "4500.00",
        "is_recurring": False
    },
    {
        "name": "DR Testing & Tabletop Exercise",
        "description": "Facilitated disaster scenario simulation with stakeholders",
        "type": "service",
        "unit_price": "1800.00",
        "is_recurring": False
    },
    {
        "name": "Cloud Disaster Recovery Solution (Monthly)",
        "description": "Azure Site Recovery or AWS Disaster Recovery as a Service",
        "type": "hosting",
        "unit_price": "500.00",
        "is_recurring": True,
        "billing_frequency": "monthly"
    },
    {
        "name": "Incident Response Runbook Creation",
        "description": "Document step-by-step procedures for common incidents",
        "type": "service",
        "unit_price": "1200.00",
        "is_recurring": False
    },
    {
        "name": "Business Continuity Plan (BCP) Development",
        "description": "Complete BCP covering alternative operations and communications",
        "type": "service",
        "unit_price": "3500.00",
        "is_recurring": False
    },
    {
        "name": "Emergency Communication System Setup",
        "description": "Deploy mass notification platform for crisis communications",
        "type": "service",
        "unit_price": "900.00",
        "is_recurring": False
    },
    {
        "name": "Work-From-Home Readiness Assessment",
        "description": "Evaluate remote work capabilities and identify gaps",
        "type": "service",
        "unit_price": "800.00",
        "is_recurring": False
    }
]

# ============================================================================
# CATEGORY 6: USER EXPERIENCE PRODUCTS
# ============================================================================

UX_PRODUCTS = [
    {
        "name": "Help Desk SLA Monitoring & Reporting",
        "description": "Implement SLA tracking dashboard and alerting",
        "type": "service",
        "unit_price": "600.00",
        "is_recurring": False
    },
    {
        "name": "Customer Satisfaction Survey Program",
        "description": "Deploy post-ticket satisfaction surveys with reporting",
        "type": "service",
        "unit_price": "500.00",
        "is_recurring": False
    },
    {
        "name": "Knowledge Base Article Creation (per article)",
        "description": "Professional documentation for common support issues",
        "type": "service",
        "unit_price": "150.00",
        "is_recurring": False
    },
    {
        "name": "Knowledge Base Platform Setup",
        "description": "Deploy searchable self-service portal for end users",
        "type": "service",
        "unit_price": "1800.00",
        "is_recurring": False
    },
    {
        "name": "End User Training Program (per user)",
        "description": "Onboarding and annual refresher training sessions",
        "type": "service",
        "unit_price": "200.00",
        "is_recurring": False
    },
    {
        "name": "Client Portal Onboarding Service",
        "description": "Train users on self-service portal features",
        "type": "service",
        "unit_price": "900.00",
        "is_recurring": False
    },
    {
        "name": "Support Process Improvement Review",
        "description": "Analyze ticket data and recommend workflow enhancements",
        "type": "service",
        "unit_price": "1200.00",
        "is_recurring": False
    }
]

# ============================================================================
# MASTER PRODUCT LIST
# ============================================================================

REMEDIATION_PRODUCTS = (
    SECURITY_PRODUCTS +
    INFRASTRUCTURE_PRODUCTS +
    DIGITAL_PRODUCTS +
    EFFICIENCY_PRODUCTS +
    CONTINUITY_PRODUCTS +
    UX_PRODUCTS
)

def seed():
    db = SessionLocal()
    print(f"🌱 Seeding Remediation Products ({len(REMEDIATION_PRODUCTS)} total)...")
    
    created = 0
    skipped = 0
    
    try:
        for product_def in REMEDIATION_PRODUCTS:
            exists = db.query(Product).filter(Product.name == product_def['name']).first()
            if not exists:
                print(f"   ✅ Creating: {product_def['name']}")
                product = Product(**product_def)
                db.add(product)
                created += 1
            else:
                print(f"   ⏭️  Skipping (exists): {product_def['name']}")
                skipped += 1
        
        db.commit()
        print(f"\n✅ Remediation Products Seeding Complete.")
        print(f"   Created: {created} | Skipped: {skipped} | Total: {len(REMEDIATION_PRODUCTS)}")
        print(f"   📦 Security: 13 | Infrastructure: 8 | Digital: 11 | Efficiency: 9 | Continuity: 7 | UX: 7")
        
    except Exception as e:
        print(f"❌ Error seeding remediation products: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Product
from app.database import SQLALCHEMY_DATABASE_URL

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

REMEDIATION_PRODUCTS = [
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

def seed():
    db = SessionLocal()
    print("🌱 Seeding Remediation Products...")
    
    try:
        for product_def in REMEDIATION_PRODUCTS:
            exists = db.query(Product).filter(Product.name == product_def['name']).first()
            if not exists:
                print(f"   Creating: {product_def['name']}")
                product = Product(**product_def)
                db.add(product)
            else:
                print(f"   Skipping (exists): {product_def['name']}")
        
        db.commit()
        print("✅ Remediation Products Seeding Complete.")
        
    except Exception as e:
        print(f"❌ Error seeding remediation products: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()

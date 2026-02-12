#!/usr/bin/env python3
"""
Master seeder for Sanctum Core.
Runs all seeders in the correct order.
"""
import sys
from app.database import engine
from app.models import Base
from seeders import automations, audit_templates, remediation_products, vendors

def main():
    print("🌱 SANCTUM CORE SEEDING")
    print("=" * 50)

    # NEW: Ensure all tables are created before seeding anything
    print("🏗️  Ensuring database tables exist...")
    Base.metadata.create_all(bind=engine)
    
    try:
        print("\n[1/3] Seeding Automations...")
        automations.seed()
        
        print("\n[2/3] Seeding Audit Templates...")
        audit_templates.seed()
        
        print("\n[3/3] Seeding Remediation Products...")
        remediation_products.seed()

        print("\n[4/4] Seeding Vendors...")
        vendors.seed()
        
        print("\n" + "=" * 50)
        print("✅ ALL SEEDERS COMPLETE")
        
    except Exception as e:
        print(f"\n❌ SEEDING FAILED: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Master seeder for Sanctum Core.
Runs all seeders in the correct order.
"""
import sys
from seeders import automations, audit_templates, remediation_products

def main():
    print("🌱 SANCTUM CORE SEEDING")
    print("=" * 50)
    
    try:
        print("\n[1/3] Seeding Automations...")
        automations.seed()
        
        print("\n[2/3] Seeding Audit Templates...")
        audit_templates.seed()
        
        print("\n[3/3] Seeding Remediation Products...")
        remediation_products.seed()
        
        print("\n" + "=" * 50)
        print("✅ ALL SEEDERS COMPLETE")
        
    except Exception as e:
        print(f"\n❌ SEEDING FAILED: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

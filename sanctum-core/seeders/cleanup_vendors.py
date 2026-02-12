import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Project path injection
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.models import Vendor
from app.database import SQLALCHEMY_DATABASE_URL

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def cleanup():
    db = SessionLocal()
    print("🧹 Starting Vendor Duplicate Cleanup...")
    
    try:
        all_vendors = db.query(Vendor).all()
        seen_names = {} # normalized_name -> master_vendor_object
        duplicates_removed = 0

        for v in all_vendors:
            norm_name = v.name.strip().lower().replace(" ", "")
            
            if norm_name in seen_names:
                master = seen_names[norm_name]
                print(f"   🔗 Merging '{v.name}' into master '{master.name}'")
                
                # Merge tags (union of both lists)
                combined_tags = list(set((master.tags or []) + (v.tags or [])))
                master.tags = combined_tags
                
                # If master is missing info that the duplicate has, fill it in
                if not master.website and v.website: master.website = v.website
                if not master.description and v.description: master.description = v.description
                
                # Delete the duplicate
                db.delete(v)
                duplicates_removed += 1
            else:
                seen_names[norm_name] = v

        db.commit()
        print(f"\n✨ Cleanup Complete! Removed {duplicates_removed} duplicate records.")
        
    except Exception as e:
        print(f"❌ Cleanup failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    cleanup()
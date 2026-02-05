import asyncio
import sys
import os
from datetime import datetime, timezone
from sqlalchemy.orm.attributes import flag_modified # Ensure this is at the top of the file

# 1. SETUP PATHS
# Ensure we can import 'app' regardless of where the script is called from
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import SessionLocal
from app.models import Notification, User, UserNotificationPreference, AuditReport
from app.services.email_service import email_service
from app.services.sentinel_engine import SentinelEngine

def process_digest_queue():
    db = SessionLocal()
    print(f"[{datetime.now()}] 📡 Signal Worker: Scanning Queue...")

    try:
        pending_notes = db.query(Notification).join(User).join(UserNotificationPreference)\
            .filter(
                Notification.status == 'pending',
                UserNotificationPreference.email_frequency != 'realtime'
            ).all()

        if not pending_notes:
            print("✅ No pending digests found.")
            return

        user_batches = {}
        for note in pending_notes:
            if note.user_id not in user_batches:
                user_batches[note.user_id] = []
            user_batches[note.user_id].append(note)

        print(f"Found {len(pending_notes)} items for {len(user_batches)} users.")

        for user_id, notes in user_batches.items():
            user = db.query(User).get(user_id)
            if not user or not user.email: continue

            print(f"📦 Batching {len(notes)} items for {user.email}...")

            grouped_by_link = {}
            standalone_notes = []

            for n in notes:
                if n.link:
                    if n.link not in grouped_by_link:
                        grouped_by_link[n.link] = []
                    grouped_by_link[n.link].append(n)
                else:
                    standalone_notes.append(n)

            # Email construction logic omitted for brevity, keeping your existing HTML block
            frontend_url = os.getenv("FRONTEND_URL", "https://portal.digitalsanctum.com.au")
            html_body = f"<h2>Sanctum Signal Digest</h2><p>Updates for {user.full_name}:</p>"
            # ... (Your existing rendering logic here) ...

            success = email_service.send(
                to_emails=user.email,
                subject=f"Sanctum Digest ({len(notes)} updates)",
                html_content=html_body
            )

            if success:
                for n in notes:
                    n.status = 'batched'
                    n.sent_at = datetime.now(timezone.utc)
                print("   -> Sent.")
            else:
                print("   -> FAILED.")

        db.commit()
    except Exception as e:
        print(f"❌ Worker Error: {e}")
        db.rollback()
    finally:
        db.close()

def process_audit_scans():
    db = SessionLocal()
    engine = SentinelEngine()
    print(f"[{datetime.now()}] 🛡️ Sentinel Worker: Checking for queued scans...")

    try:
        # Fetch audits specifically marked as queued
        queued_audits = db.query(AuditReport).filter(AuditReport.scan_status == 'queued').all()

        for audit in queued_audits:
            if not audit.target_url:
                print(f"   -> Audit {audit.id} has no target URL. Skipping.")
                audit.scan_status = 'failed'
                db.commit()
                continue

            print(f"   -> 🚀 Starting Deep Scan for: {audit.target_url} (Audit: {audit.id})")
            audit.scan_status = 'running'
            db.commit()

            try:
                # 1. Execute the Engine
                scan_results = asyncio.run(engine.perform_scan(audit.target_url))
                
                # 2. MERGE LOGIC: Don't overwrite, deduplicate
                current_content = audit.content or {"items": []}
                existing_items = current_content.get('items', [])
                
                # Create a map to avoid duplicate (Category + Item) pairs
                item_map = { (i['category'], i['item']): i for i in existing_items }
                
                for new_item in scan_results:
                    item_map[(new_item['category'], new_item['item'])] = new_item
                
                # Save the merged list back to the audit
                audit.content = {"items": list(item_map.values())}
                
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(audit, "content")
                
                audit.scan_status = 'completed'
                audit.last_scan_at = datetime.now(timezone.utc)
                db.commit()
                print(f"   -> ✅ Merge complete. Total items: {len(audit.content['items'])}")

            except Exception as scan_err:
                print(f"   -> ❌ Scan failed for {audit.id}: {scan_err}")
                audit.scan_status = 'failed'
                db.commit()

    except Exception as e:
        print(f"❌ Sentinel Worker Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    process_digest_queue()
    process_audit_scans()
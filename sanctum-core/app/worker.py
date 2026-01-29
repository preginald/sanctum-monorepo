import sys
import os
from sqlalchemy import func
from datetime import datetime, timezone

# Setup Path to import app modules
sys.path.append(os.getcwd())

from app.database import SessionLocal
from app.models import Notification, User, UserNotificationPreference
from app.services.email_service import email_service

def process_digest_queue():
    db = SessionLocal()
    print(f"[{datetime.now()}] 📡 Signal Worker: Scanning Queue...")

    try:
        # 1. Identify Users expecting Digests (Hourly/Daily)
        # Note: In a real prod cron, we'd filter by 'hourly' vs 'daily' depending on time.
        # For MVP, we process ALL pending non-realtime items.
        
        # Get users with pending notifications who are NOT realtime
        # This query implies: Find Pending Notes -> Join User -> Join Prefs -> Filter Freq != Realtime
        
        pending_notes = db.query(Notification).join(User).join(UserNotificationPreference)\
            .filter(
                Notification.status == 'pending',
                UserNotificationPreference.email_frequency != 'realtime'
            ).all()

        if not pending_notes:
            print("✅ No pending digests found.")
            return

        # 2. Group by User
        user_batches = {}
        for note in pending_notes:
            if note.user_id not in user_batches:
                user_batches[note.user_id] = []
            user_batches[note.user_id].append(note)

        print(f"found {len(pending_notes)} items for {len(user_batches)} users.")

        # 3. Process Batches
        for user_id, notes in user_batches.items():
            user = db.query(User).get(user_id)
            if not user or not user.email: continue

            print(f"📦 Batching {len(notes)} items for {user.email}...")

            # Construct Digest Content
            html_body = f"<h2>Sanctum Signal Digest</h2><p>You have {len(notes)} new updates.</p><hr>"
            
            for n in notes:
                icon = "🔴" if n.priority == 'critical' else "🔵"
                html_body += f"""
                <div style="margin-bottom: 15px;">
                    <strong>{icon} {n.title}</strong><br>
                    <span style="color: #666;">{n.message}</span><br>
                    {f'<a href="{os.getenv("FRONTEND_URL")}{n.link}">View Item</a>' if n.link else ''}
                </div>
                """
            
            html_body += f"<hr><small>Generated at {datetime.now().strftime('%H:%M')}</small>"

            # Send Email
            success = email_service.send(
                to_emails=user.email,
                subject=f"Sanctum Digest ({len(notes)} updates)",
                html_content=html_body
            )

            # Update DB Status
            if success:
                for n in notes:
                    n.status = 'batched'
                    n.sent_at = datetime.now(timezone.utc)
                print("   -> Sent & Marked Batched.")
            else:
                print("   -> FAILED.")

        db.commit()

    except Exception as e:
        print(f"❌ Worker Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    process_digest_queue()
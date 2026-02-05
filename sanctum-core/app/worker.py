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
        # For MVP, we process ALL pending non-realtime items.
        
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

            # --- SMART AGGREGATION LOGIC ---
            grouped_by_link = {}
            standalone_notes = []

            for n in notes:
                if n.link:
                    if n.link not in grouped_by_link:
                        grouped_by_link[n.link] = []
                    grouped_by_link[n.link].append(n)
                else:
                    standalone_notes.append(n)

            # Construct Digest Content
            html_body = f"""
            <div style="font-family: sans-serif; color: #333;">
                <h2 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Sanctum Signal Digest</h2>
                <p>Here is your summary of recent activity.</p>
            """
            
            frontend_url = os.getenv("FRONTEND_URL", "https://portal.digitalsanctum.com.au")

            # A. Render Grouped Items (Tickets, Deals, etc.)
            for link, group in grouped_by_link.items():
                # Deduplicate messages within this group
                unique_messages = set()
                clean_messages = []
                
                # Use the title from the most recent notification in the group as the header
                # (Assumes the title contains the entity name like "[Ticket #154]...")
                header_title = group[-1].title 

                for n in group:
                    if n.message not in unique_messages:
                        unique_messages.add(n.message)
                        clean_messages.append(n)
                
                # Render Block
                icon = "🔴" if any(n.priority == 'critical' for n in group) else "🔵"
                
                html_body += f"""
                <div style="margin-bottom: 25px; background-color: #f8fafc; padding: 15px; border-radius: 6px; border-left: 4px solid #3b82f6;">
                    <div style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">{icon} {header_title}</div>
                    <ul style="margin: 0; padding-left: 20px; color: #475569;">
                """
                
                for n in clean_messages:
                    html_body += f'<li style="margin-bottom: 4px;">{n.message}</li>'

                html_body += f"""
                    </ul>
                    <div style="margin-top: 10px;">
                        <a href="{frontend_url}{link}" style="font-size: 13px; color: #2563eb; text-decoration: none; font-weight: 600;">View Item &rarr;</a>
                    </div>
                </div>
                """

            # B. Render Standalone Items (System Alerts, General updates)
            if standalone_notes:
                 html_body += '<h3 style="margin-top: 30px; font-size: 14px; text-transform: uppercase; color: #94a3b8;">Other Updates</h3>'
                 for n in standalone_notes:
                    icon = "🔴" if n.priority == 'critical' else "⚪"
                    html_body += f"""
                    <div style="margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
                        <strong>{icon} {n.title}</strong><br>
                        <span style="color: #666;">{n.message}</span>
                    </div>
                    """

            html_body += f"<hr style='border: 0; border-top: 1px solid #e2e8f0; margin-top: 30px;'><small style='color: #94a3b8;'>Generated at {datetime.now().strftime('%H:%M')}</small></div>"

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

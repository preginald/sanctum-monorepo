# sanctum-core/app/services/renewal_engine.py
# Phase 66: The Steward — Asset Renewal Engine
# Orchestrates renewal invoice generation, notifications, and escalations.

from datetime import date, timedelta
from sqlalchemy.orm import Session, joinedload
from ..models import Asset, Account, User
from .billing_service import billing_service
from .notification_service import notification_service
from .email_service import email_service
import os


class RenewalEngine:

    def run(self, db: Session):
        print(f"[RenewalEngine] Starting run for {date.today()}")
        self._process_renewals(db)
        self._process_escalations(db)
        print(f"[RenewalEngine] Run complete.")

    # ─────────────────────────────────────────────
    # STEP 1: 30-day scan — find, invoice, stamp, notify
    # ─────────────────────────────────────────────
    def _process_renewals(self, db: Session):
        today = date.today()
        window = today + timedelta(days=30)

        assets = db.query(Asset).options(
            joinedload(Asset.account),
            joinedload(Asset.linked_product)
        ).filter(
            Asset.expires_at <= window,
            Asset.expires_at >= today,
            Asset.auto_invoice == True,
            Asset.linked_product_id != None,
            Asset.pending_renewal_invoice_id == None,
            Asset.status == 'active'
        ).all()

        print(f"[RenewalEngine] {len(assets)} asset(s) due for renewal processing.")

        for asset in assets:
            try:
                result = billing_service.check_and_invoice_asset(db, asset.id)

                if result.get('status') != 'generated':
                    print(f"[RenewalEngine] Skipped {asset.name}: {result.get('reason')}")
                    continue

                invoice_id = result['invoice_id']

                # Stamp idempotency lock
                asset.pending_renewal_invoice_id = invoice_id
                db.commit()

                account = asset.account
                invoice_url = f"{os.getenv('FRONTEND_URL', 'https://core.digitalsanctum.com.au')}/invoices/{invoice_id}"

                # Internal notification — all admin/tech users
                staff = db.query(User).filter(
                    User.role.in_(['admin', 'tech']),
                    User.is_active == True
                ).all()

                staff_recipients = [
                    {'type': 'user', 'user_id': u.id, 'email': u.email}
                    for u in staff
                ]

                notification_service.enqueue(
                    db=db,
                    recipients=staff_recipients,
                    subject=f"Renewal Invoice Generated — {asset.name}",
                    message=f"A renewal invoice has been auto-generated for {asset.name} ({account.name}). Expires: {asset.expires_at.strftime('%d %b %Y')}.",
                    link=invoice_url,
                    priority='normal',
                    event_payload={
                        'asset_id': str(asset.id),
                        'asset_name': asset.name,
                        'account_id': str(account.id),
                        'account_name': account.name,
                        'invoice_id': str(invoice_id),
                        'expires_at': asset.expires_at.isoformat()
                    }
                )

                # Client billing email
                if account.billing_email:
                    email_service.send_template(
                        to_email=account.billing_email,
                        subject=f"Renewal Invoice Ready — {asset.name}",
                        template_name="renewal_invoice_ready.html",
                        context={
                            "account_name": account.name,
                            "asset_name": asset.name,
                            "asset_type": asset.asset_type,
                            "expires_at": asset.expires_at.strftime("%d %b %Y"),
                            "invoice_url": invoice_url
                        }
                    )
                    print(f"[RenewalEngine] ✓ Client email sent to {account.billing_email} for {asset.name}")
                else:
                    print(f"[RenewalEngine] ⚠ No billing_email for account {account.name} — skipping client email")

            except Exception as e:
                print(f"[RenewalEngine] ❌ Error processing asset {asset.id}: {e}")
                db.rollback()
                continue

    # ─────────────────────────────────────────────
    # STEP 2: 7-day escalation scan
    # ─────────────────────────────────────────────
    def _process_escalations(self, db: Session):
        today = date.today()
        window = today + timedelta(days=7)

        assets = db.query(Asset).options(
            joinedload(Asset.account)
        ).filter(
            Asset.pending_renewal_invoice_id != None,
            Asset.expires_at <= window,
            Asset.expires_at >= today,
            Asset.status == 'active'
        ).all()

        if not assets:
            print(f"[RenewalEngine] No escalations required.")
            return

        print(f"[RenewalEngine] {len(assets)} asset(s) require escalation.")

        staff = db.query(User).filter(
            User.role.in_(['admin', 'tech']),
            User.is_active == True
        ).all()

        staff_recipients = [
            {'type': 'user', 'user_id': u.id, 'email': u.email}
            for u in staff
        ]

        for asset in assets:
            try:
                account = asset.account
                days_left = (asset.expires_at - today).days
                invoice_url = f"{os.getenv('FRONTEND_URL', 'https://core.digitalsanctum.com.au')}/invoices/{asset.pending_renewal_invoice_id}"

                notification_service.enqueue(
                    db=db,
                    recipients=staff_recipients,
                    subject=f"⚠ Escalation: {asset.name} expires in {days_left} day(s)",
                    message=f"{asset.name} ({account.name}) expires in {days_left} day(s) and the renewal invoice is still unpaid.",
                    link=invoice_url,
                    priority='critical',
                    event_payload={
                        'asset_id': str(asset.id),
                        'asset_name': asset.name,
                        'account_id': str(account.id),
                        'account_name': account.name,
                        'invoice_id': str(asset.pending_renewal_invoice_id),
                        'expires_at': asset.expires_at.isoformat(),
                        'days_left': days_left
                    }
                )

                print(f"[RenewalEngine] ✓ Escalation fired for {asset.name} ({days_left}d remaining)")

            except Exception as e:
                print(f"[RenewalEngine] ❌ Escalation error for asset {asset.id}: {e}")
                continue


renewal_engine = RenewalEngine()

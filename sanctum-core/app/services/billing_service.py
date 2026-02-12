from sqlalchemy.orm import Session
from decimal import Decimal, ROUND_HALF_UP
from datetime import date, timedelta, datetime, timezone
from uuid import UUID  # <--- Added this import
from ..models import Asset, Invoice, InvoiceItem

class BillingService:
    @staticmethod
    def calculate_tax(subtotal: float | Decimal) -> Decimal:
        # Convert to Decimal for math
        sub = Decimal(str(subtotal))
        # GST is 10%
        tax = sub * Decimal("0.10")
        return tax.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    @staticmethod
    def calculate_totals(items: list) -> dict:
        """
        Iterates through invoice items (dicts or objects) and calculates totals.
        Returns dictionary of Decimals.
        """
        subtotal = Decimal("0.00")
        
        for item in items:
            # Handle both SQLAlchemy objects and Pydantic models/dicts
            qty = Decimal(str(item.quantity)) if hasattr(item, 'quantity') else Decimal(str(item['quantity']))
            price = Decimal(str(item.unit_price)) if hasattr(item, 'unit_price') else Decimal(str(item['unit_price']))
            
            line_total = qty * price
            line_total = line_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            
            subtotal += line_total

        gst = subtotal * Decimal("0.10")
        gst = gst.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        
        total = subtotal + gst
        
        return {
            "subtotal": subtotal,
            "gst": gst,
            "total": total
        }

    def generate_renewals(self, db: Session):
        """
        Scans for assets expiring in exactly 30 days with auto_invoice=True.
        Generates DRAFT invoices.
        """
        target_date = date.today() + timedelta(days=30)
        
        # Find expiring assets
        expiring = db.query(Asset).filter(
            Asset.expires_at == target_date,
            Asset.auto_invoice == True,
            Asset.status == 'active',
            Asset.linked_product_id != None
        ).all()
        
        generated_count = 0
        
        for asset in expiring:
            # Create Invoice Header
            invoice = Invoice(
                account_id=asset.account_id,
                status='draft',
                payment_terms='Net 14 Days',
                due_date=asset.expires_at # Due on expiry
            )
            db.add(invoice)
            db.flush() # Get ID
            
            # Create Line Item from Linked Product
            product = asset.linked_product
            # Ensure price is Decimal for safe math
            price = Decimal(str(product.unit_price))
            
            item = InvoiceItem(
                invoice_id=invoice.id,
                description=f"Renewal: {asset.name} ({asset.asset_type}) - {product.name}",
                quantity=1,
                unit_price=price,
                total=price,
                source_type='asset_renewal',
                source_id=asset.id
            )
            db.add(item)
            
            # Update Invoice Totals
            invoice.subtotal_amount = price
            invoice.gst_amount = (price * Decimal("0.10")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            invoice.total_amount = invoice.subtotal_amount + invoice.gst_amount
            
            generated_count += 1
            
        db.commit()
        return {"status": "success", "generated": generated_count}

    def check_and_invoice_asset(self, db: Session, asset_id: UUID) -> dict:
        """
        Triggers an immediate check for a single asset.
        If the asset is expired or expiring within 30 days AND has no recent invoice,
        it generates one immediately.
        """
        asset = db.query(Asset).filter(Asset.id == asset_id).first()
        if not asset or not asset.auto_invoice or not asset.linked_product_id:
            return {"status": "skipped", "reason": "Not configured for auto-billing"}

        # 1. Check Billing Window (Past OR Future 30 days)
        today = date.today()
        # If expiry is in the past OR within the next 30 days
        is_due = asset.expires_at <= (today + timedelta(days=30))
        
        if not is_due:
            return {"status": "skipped", "reason": "Not due for billing yet"}

        # 2. Duplicate Check
        # Look for any invoice created in the last 45 days linked to this asset
        # to prevent double-billing if you click 'Save' multiple times.
        recent_invoice = db.query(InvoiceItem).join(Invoice).filter(
            InvoiceItem.source_id == asset.id,
            InvoiceItem.source_type == 'asset_renewal',
            Invoice.generated_at >= (datetime.now(timezone.utc) - timedelta(days=45))
        ).first()

        if recent_invoice:
            return {"status": "skipped", "reason": "Invoice already exists"}

        # 3. Generate Invoice
        # Create Header
        invoice = Invoice(
            account_id=asset.account_id,
            status='draft',
            payment_terms='Net 14 Days',
            due_date=date.today(), # Due immediately since we are catching up
            generated_at=datetime.now(timezone.utc)
        )
        db.add(invoice)
        db.flush()

        # Create Line Item
        product = asset.linked_product
        price = Decimal(str(product.unit_price))
        
        item = InvoiceItem(
            invoice_id=invoice.id,
            description=f"Renewal (Catch-up): {asset.name} - {product.name}",
            quantity=1,
            unit_price=price,
            total=price,
            source_type='asset_renewal',
            source_id=asset.id
        )
        db.add(item)

        # Update Totals
        invoice.subtotal_amount = price
        invoice.gst_amount = (price * Decimal("0.10")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        invoice.total_amount = invoice.subtotal_amount + invoice.gst_amount

        db.commit()
        return {"status": "generated", "invoice_id": invoice.id}

billing_service = BillingService()
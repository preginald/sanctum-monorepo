from sqlalchemy.orm import Session
from decimal import Decimal, ROUND_HALF_UP

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
        # Ensure Asset model has 'expires_at' and 'auto_invoice' fields
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
            # Using the same safe rounding logic as the static methods
            invoice.subtotal_amount = price
            invoice.gst_amount = (price * Decimal("0.10")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            invoice.total_amount = invoice.subtotal_amount + invoice.gst_amount
            
            generated_count += 1
            
        db.commit()
        return {"status": "success", "generated": generated_count}

billing_service = BillingService()
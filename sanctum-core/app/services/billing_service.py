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

billing_service = BillingService()
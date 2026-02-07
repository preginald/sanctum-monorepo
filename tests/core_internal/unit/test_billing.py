import pytest
from decimal import Decimal
from app.services.billing_service import billing_service

# Mock Item Class to simulate Pydantic/ORM objects
class MockItem:
    def __init__(self, quantity, unit_price):
        self.quantity = quantity
        self.unit_price = unit_price

def test_calculate_tax_basic():
    """Test 10% GST calculation on simple integers"""
    tax = billing_service.calculate_tax(100)
    assert tax == Decimal("10.00")

def test_calculate_tax_rounding():
    """Test rounding logic (ROUND_HALF_UP)"""
    # 10.555 * 0.10 = 1.0555 -> Should round to 1.06
    tax = billing_service.calculate_tax(10.555)
    assert tax == Decimal("1.06")

def test_invoice_totals_structure():
    """Test that the dictionary returned has correct keys and types"""
    items = [MockItem(1, 100)]
    result = billing_service.calculate_totals(items)
    
    assert "subtotal" in result
    assert "gst" in result
    assert "total" in result
    assert isinstance(result["total"], Decimal)

def test_complex_invoice_math():
    """Test a realistic invoice with multiple items and decimals"""
    items = [
        # Item 1: 2.5 hours @ $150.00 = $375.00
        MockItem(2.5, 150.00),
        # Item 2: 1 hardware @ $99.99 = $99.99
        MockItem(1, 99.99)
    ]
    
    # Expected Subtotal: 375.00 + 99.99 = 474.99
    # Expected GST: 47.499 -> 47.50
    # Expected Total: 474.99 + 47.50 = 522.49
    
    result = billing_service.calculate_totals(items)
    
    assert result["subtotal"] == Decimal("474.99")
    assert result["gst"] == Decimal("47.50")
    assert result["total"] == Decimal("522.49")

def test_empty_invoice():
    """Test behavior with no items"""
    result = billing_service.calculate_totals([])
    assert result["total"] == Decimal("0.00")
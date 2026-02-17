from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import datetime, timedelta
import os
from .. import models, schemas, auth
from ..database import get_db
from ..services.email_service import email_service
from ..services.pdf_engine import pdf_engine
from ..services.billing_service import billing_service

router = APIRouter(prefix="/invoices", tags=["Invoices"])

def recalculate_invoice(invoice_id: str, db: Session):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice: return

    totals = billing_service.calculate_totals(invoice.items)

    for item in invoice.items:
        item.total = round(item.quantity * item.unit_price, 2)

    invoice.subtotal_amount = totals["subtotal"]
    invoice.gst_amount = totals["gst"]
    invoice.total_amount = totals["total"]
    invoice.generated_at = func.now()
    
    db.commit()
    db.refresh(invoice)
    return invoice

def regenerate_pdf_file(inv, db: Session):
    """Helper to refresh the PDF file on disk with latest DB data"""
    cwd = os.getcwd()
    static_dir = os.path.join(cwd, "app/static/reports")
    if not os.path.exists(static_dir): os.makedirs(static_dir)

    data = {
        "id": str(inv.id), "client_name": inv.account.name, "date": str(inv.generated_at.date()),
        "subtotal": inv.subtotal_amount, "gst": inv.gst_amount, "total": inv.total_amount,
        "payment_terms": inv.payment_terms,
        "status": inv.status,
        "paid_at": str(inv.paid_at.date()) if inv.paid_at else None,
        "payment_method": inv.payment_method,
        "items": [{"desc": i.description, "qty": i.quantity, "price": i.unit_price, "total": i.total} for i in inv.items]
    }
    pdf = pdf_engine.generate_invoice_pdf(data)
    filename = f"invoice_{inv.id}.pdf"
    abs_path = os.path.join(static_dir, filename)
    pdf.output(abs_path)
    
    # Update path if missing
    if not inv.pdf_path:
        inv.pdf_path = f"/static/reports/{filename}"
        db.commit()

@router.get("/unpaid", tags=["Invoices"])
def get_unpaid_invoices(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Returns all non-paid, non-draft, non-void invoices with account context and overdue calculation."""
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin only.")

    invoices = db.query(models.Invoice).options(
        joinedload(models.Invoice.account),
        joinedload(models.Invoice.items)
    ).filter(
        models.Invoice.status.in_(['sent'])
    ).order_by(models.Invoice.due_date.asc().nullsfirst()).all()

    today = datetime.now().date()
    result = []
    for inv in invoices:
        days_overdue = (today - inv.due_date).days if inv.due_date and today > inv.due_date else 0
        result.append({
            "id": str(inv.id),
            "account_id": str(inv.account_id),
            "account_name": inv.account.name if inv.account else "Unknown",
            "billing_email": inv.account.billing_email if inv.account else None,
            "total_amount": float(inv.total_amount or 0),
            "status": inv.status,
            "due_date": inv.due_date.isoformat() if inv.due_date else None,
            "generated_at": inv.generated_at.isoformat() if inv.generated_at else None,
            "days_overdue": days_overdue,
            "is_overdue": days_overdue > 0,
            "has_pdf": bool(inv.pdf_path)
        })

    return {
        "total_count": len(result),
        "total_outstanding": sum(r["total_amount"] for r in result),
        "overdue_count": sum(1 for r in result if r["is_overdue"]),
        "invoices": result
    }

@router.post("/from_ticket/{ticket_id}", response_model=schemas.InvoiceResponse)
def generate_invoice_from_ticket(ticket_id: int, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    # 1. Fetch Ticket
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket: raise HTTPException(status_code=404, detail="Ticket not found")

    # 2. Fetch UNBILLED Items Only (Stateful Generation)
    unbilled_time = db.query(models.TicketTimeEntry).options(joinedload(models.TicketTimeEntry.product)).filter(
        models.TicketTimeEntry.ticket_id == ticket_id,
        models.TicketTimeEntry.invoice_id == None 
    ).all()

    unbilled_materials = db.query(models.TicketMaterial).options(joinedload(models.TicketMaterial.product)).filter(
        models.TicketMaterial.ticket_id == ticket_id,
        models.TicketMaterial.invoice_id == None
    ).all()

    if not unbilled_time and not unbilled_materials:
        raise HTTPException(status_code=400, detail="No unbilled items found for this ticket. Previous items may already be on an invoice.")

    items_buffer = []

    # Process Time Entries
    for entry in unbilled_time:
        hours = entry.duration_minutes / 60
        if hours <= 0: continue
        rate = entry.product.unit_price if entry.product else 0.0
        desc = f"Labor: {entry.product.name} ({entry.user_name})" if entry.product else f"Labor: General ({entry.user_name})"
        if entry.description: desc += f" - {entry.description}"
        desc += f" [Ref: Ticket #{ticket.id}]"
        line_total = hours * float(rate)
        
        items_buffer.append({
            "description": desc, 
            "quantity": round(hours, 2), 
            "unit_price": rate, 
            "total": round(line_total, 2), 
            "ticket_id": ticket.id, 
            "source_type": "time", 
            "source_id": entry.id
        })

    # Process Materials
    for mat in unbilled_materials:
        price = mat.product.unit_price if mat.product else 0.0
        name = f"Hardware: {mat.product.name}" if mat.product else "Hardware: Unidentified"
        name += f" [Ref: Ticket #{ticket.id}]"
        line_total = mat.quantity * float(price)
        
        items_buffer.append({
            "description": name, 
            "quantity": float(mat.quantity), 
            "unit_price": price, 
            "total": round(line_total, 2), 
            "ticket_id": ticket.id, 
            "source_type": "material", 
            "source_id": mat.id
        })

    if not items_buffer: 
         raise HTTPException(status_code=400, detail="Items found but calculated value is 0 (check durations or prices).")

    # 3. Create Invoice Header
    new_invoice = models.Invoice(
        account_id=ticket.account_id, status="draft", 
        due_date=datetime.now() + timedelta(days=14), generated_at=func.now()
    )
    db.add(new_invoice)
    db.flush() # Get ID

    # 4. Create Invoice Items
    for item in items_buffer:
        db.add(models.InvoiceItem(invoice_id=new_invoice.id, **item))
    
    # 5. LOCKING: Update the source rows with the invoice_id
    for entry in unbilled_time:
        entry.invoice_id = new_invoice.id
        
    for mat in unbilled_materials:
        mat.invoice_id = new_invoice.id

    db.commit()
    
    inv = recalculate_invoice(new_invoice.id, db)
    regenerate_pdf_file(inv, db) # Force create PDF immediately
    return inv

@router.get("/{invoice_id}", response_model=schemas.InvoiceResponse)
def get_invoice_detail(invoice_id: str, db: Session = Depends(get_db)):
    inv = db.query(models.Invoice).options(
            joinedload(models.Invoice.items).joinedload(models.InvoiceItem.ticket).joinedload(models.Ticket.contacts),
            joinedload(models.Invoice.delivery_logs).joinedload(models.InvoiceDeliveryLog.sender)
        ).filter(models.Invoice.id == invoice_id).first()
    if not inv: raise HTTPException(status_code=404, detail="Invoice not found")
    inv.account_name = inv.account.name
    for log in inv.delivery_logs:
        if log.sender: log.sender_name = log.sender.full_name
    
    cc_set = set()
    for item in inv.items:
        if item.ticket:
            for c in item.ticket.contacts:
                if c.email: cc_set.add(c.email)
    inv.suggested_cc = list(cc_set)
    return inv

@router.put("/{invoice_id}", response_model=schemas.InvoiceResponse)
def update_invoice_meta(invoice_id: str, update: schemas.InvoiceUpdate, db: Session = Depends(get_db)):
    # Need to join items and account to regenerate PDF
    inv = db.query(models.Invoice).options(joinedload(models.Invoice.items), joinedload(models.Invoice.account)).filter(models.Invoice.id == invoice_id).first()
    
    if not inv: raise HTTPException(status_code=404, detail="Invoice not found")
    
    if update.status: inv.status = update.status
    if update.due_date: inv.due_date = update.due_date
    if update.payment_terms: inv.payment_terms = update.payment_terms
    if update.generated_at: inv.generated_at = update.generated_at
    
    if update.paid_at is not None: inv.paid_at = update.paid_at
    if update.payment_method: inv.payment_method = update.payment_method
    
    db.commit()
    db.refresh(inv)
    
    # FORCE REGENERATE PDF
    try:
        regenerate_pdf_file(inv, db)
    except Exception as e:
        print(f"PDF Regen Failed: {e}")
    
    inv.account_name = inv.account.name
    return inv

@router.delete("/{invoice_id}")
def delete_invoice(invoice_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only Admins can delete invoices.")

    inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not inv: 
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if inv.status != 'draft':
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete invoice in '{inv.status}' status. Only drafts can be deleted."
        )

    # UNLOCKING: Release the source items back to the pool
    # Use synchronize_session=False to avoid evaluation errors on bulk updates
    db.query(models.TicketTimeEntry).filter(models.TicketTimeEntry.invoice_id == invoice_id).update({"invoice_id": None}, synchronize_session=False)
    db.query(models.TicketMaterial).filter(models.TicketMaterial.invoice_id == invoice_id).update({"invoice_id": None}, synchronize_session=False)

    db.delete(inv)
    db.commit()
    return {"status": "deleted", "id": invoice_id}

@router.post("/{invoice_id}/items", response_model=schemas.InvoiceResponse)
def add_invoice_item(invoice_id: str, item: schemas.InvoiceItemCreate, db: Session = Depends(get_db)):
    new_item = models.InvoiceItem(
        invoice_id=invoice_id, description=item.description, quantity=item.quantity, unit_price=item.unit_price,
        total=round(item.quantity * item.unit_price, 2)
    )
    db.add(new_item)
    db.commit()
    inv = recalculate_invoice(invoice_id, db)
    regenerate_pdf_file(inv, db) # Regen PDF
    return inv

@router.put("/items/{item_id}", response_model=schemas.InvoiceResponse)
def update_invoice_item(item_id: str, update: schemas.InvoiceItemUpdate, db: Session = Depends(get_db)):
    item = db.query(models.InvoiceItem).filter(models.InvoiceItem.id == item_id).first()
    if not item: raise HTTPException(status_code=404, detail="Item not found")
    if update.description is not None: item.description = update.description
    if update.quantity is not None: item.quantity = update.quantity
    if update.unit_price is not None: item.unit_price = update.unit_price
    item.total = round(item.quantity * item.unit_price, 2)
    db.commit()
    inv = recalculate_invoice(item.invoice_id, db)
    regenerate_pdf_file(inv, db) # Regen PDF
    return inv

@router.delete("/items/{item_id}", response_model=schemas.InvoiceResponse)
def delete_invoice_item(item_id: str, db: Session = Depends(get_db)):
    item = db.query(models.InvoiceItem).filter(models.InvoiceItem.id == item_id).first()
    if not item: raise HTTPException(status_code=404, detail="Item not found")
    pid = item.invoice_id
    
    # Unlock source if linked
    if item.source_type == 'time' and item.source_id:
        db.query(models.TicketTimeEntry).filter(models.TicketTimeEntry.id == item.source_id).update({"invoice_id": None})
    elif item.source_type == 'material' and item.source_id:
        db.query(models.TicketMaterial).filter(models.TicketMaterial.id == item.source_id).update({"invoice_id": None})
        
    db.delete(item)
    db.commit()
    inv = recalculate_invoice(pid, db)
    regenerate_pdf_file(inv, db) # Regen PDF
    return inv

@router.put("/{invoice_id}/void", response_model=schemas.InvoiceResponse)
def void_invoice(invoice_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only Admins can void invoices.")

    inv = db.query(models.Invoice).options(joinedload(models.Invoice.items)).filter(models.Invoice.id == invoice_id).first()
    
    if not inv: 
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if inv.status == 'paid':
        raise HTTPException(status_code=400, detail="Cannot void a Paid invoice.")

    if inv.status != 'void':
        # UNLOCKING
        db.query(models.TicketTimeEntry).filter(models.TicketTimeEntry.invoice_id == invoice_id).update({"invoice_id": None}, synchronize_session=False)
        db.query(models.TicketMaterial).filter(models.TicketMaterial.invoice_id == invoice_id).update({"invoice_id": None}, synchronize_session=False)

        # Clear legacy links
        for item in inv.items:
            item.source_id = None
            item.source_type = None
            item.ticket_id = None
        
        inv.status = 'void'
        inv.subtotal_amount = 0
        inv.gst_amount = 0
        inv.total_amount = 0
        
        db.commit()
    
    # Reload fresh to return
    fresh_inv = db.query(models.Invoice).options(
        joinedload(models.Invoice.items), joinedload(models.Invoice.account)
    ).filter(models.Invoice.id == invoice_id).first()
    
    regenerate_pdf_file(fresh_inv, db) # Update PDF to show Void
    return schemas.InvoiceResponse.model_validate(fresh_inv)

@router.post("/{invoice_id}/send")
def send_invoice_email(
    invoice_id: str, 
    request: schemas.InvoiceSendRequest, 
    current_user: models.User = Depends(auth.get_current_active_user), 
    db: Session = Depends(get_db)
    ):
    inv = db.query(models.Invoice).options(joinedload(models.Invoice.account), joinedload(models.Invoice.items)).filter(models.Invoice.id == invoice_id).first()
    if not inv: raise HTTPException(status_code=404, detail="Invoice not found")

    to_email = request.to_email.strip()
    cc_emails = [email.strip() for email in request.cc_emails if email.strip()]

    # Ensure PDF is current
    regenerate_pdf_file(inv, db)
    
    cwd = os.getcwd()
    filename = f"invoice_{inv.id}.pdf"
    abs_path = os.path.join(cwd, "app/static/reports", filename)

    # Greeting Logic
    greeting_name = "Team" 
    if request.recipient_contact_id:
        contact = db.query(models.Contact).filter(models.Contact.id == request.recipient_contact_id).first()
        if contact: greeting_name = contact.first_name
    elif inv.account_id:
        contacts = db.query(models.Contact).filter(models.Contact.account_id == inv.account_id).all()
        matched_contact = next((c for c in contacts if c.email == to_email), None)
        if matched_contact:
            greeting_name = matched_contact.first_name
        else:
            billing_lead = next((c for c in contacts if c.persona == 'Billing Lead'), None)
            if billing_lead: greeting_name = billing_lead.first_name

    # Email Context
    is_paid = inv.status == 'paid'
    
    if is_paid:
        date_label = "Paid On"
        date_value = inv.paid_at.strftime("%d %b %Y") if inv.paid_at else "Previously Paid"
        amount_label = "Amount Paid"
        amount_color = "#059669" 
        default_message = "Thank you for your payment. A receipt is attached for your records."
        status_banner = "PAID"
    else:
        date_label = "Due Date"
        if inv.payment_terms and ("receipt" in inv.payment_terms.lower() or "immediate" in inv.payment_terms.lower()):
            date_value = "Due on Receipt"
        else:
            date_value = inv.due_date.strftime("%d %b %Y") if inv.due_date else "Due on Receipt"
        amount_label = "Amount Due"
        amount_color = "#d4af37" 
        default_message = "Please find attached the invoice for the recent period. We appreciate your continued partnership."
        status_banner = None

    context = {
        "client_name": greeting_name, 
        "invoice_number": str(inv.id)[:8].upper(),
        "issue_date": inv.generated_at.strftime("%d %b %Y") if inv.generated_at else "N/A",
        "date_label": date_label,
        "date_value": date_value,
        "amount_label": amount_label,
        "amount_color": amount_color,
        "total_amount": "{:,.2f}".format(inv.total_amount or 0.0),
        "custom_message": request.message or default_message,
        "status_banner": status_banner
    }
    
    subject = request.subject or f"Invoice #{str(inv.id)[:8].upper()} from Digital Sanctum"
    if is_paid and (not request.subject or request.subject.startswith("Invoice #")):
        subject = f"Receipt: Invoice #{str(inv.id)[:8].upper()} - PAID"

    success = email_service.send_template(
        to_email=to_email,
        subject=subject,
        template_name="invoice_notice.html",
        context=context,
        cc_emails=cc_emails,
        attachments=[abs_path]
    )

    if not success: raise HTTPException(status_code=500, detail="Email failed")
    
    db.add(models.InvoiceDeliveryLog(invoice_id=inv.id, sent_by_user_id=current_user.id, sent_to=to_email, sent_cc=",".join(cc_emails), status="sent"))
    if not is_paid: inv.status = 'sent'
    db.commit()
    return {"status": "sent"}
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import datetime, timedelta
import os
from .. import models, schemas, auth
from ..database import get_db
from ..services.email_service import email_service
from ..services.pdf_engine import pdf_engine
# NEW: Import Billing Service
from ..services.billing_service import billing_service

router = APIRouter(prefix="/invoices", tags=["Invoices"])

def recalculate_invoice(invoice_id: str, db: Session):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice: return

    # NEW: Logic delegated to Service
    totals = billing_service.calculate_totals(invoice.items)

    # Update line item totals (persistence)
    for item in invoice.items:
        # Simple recalculation of line total to ensure consistency
        # In a real app, you might want to call a service method for line items too
        item.total = round(item.quantity * item.unit_price, 2)

    invoice.subtotal_amount = totals["subtotal"]
    invoice.gst_amount = totals["gst"]
    invoice.total_amount = totals["total"]
    invoice.generated_at = func.now()
    
    db.commit()
    db.refresh(invoice)
    return invoice

@router.post("/from_ticket/{ticket_id}", response_model=schemas.InvoiceResponse)
def generate_invoice_from_ticket(ticket_id: int, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    # Note: API path updated slightly to fit router prefix conventions
    ticket = db.query(models.Ticket).options(
            joinedload(models.Ticket.time_entries).joinedload(models.TicketTimeEntry.product),
            joinedload(models.Ticket.materials).joinedload(models.TicketMaterial.product)
        ).filter(models.Ticket.id == ticket_id).first()
    if not ticket: raise HTTPException(status_code=404, detail="Ticket not found")

    # [Logic for extracting items remains same, but we use Decimal for initial calcs in buffer]
    items_buffer = []
    running_subtotal = 0.0

    for entry in ticket.time_entries:
        hours = entry.duration_minutes / 60
        if hours <= 0: continue
        rate = entry.product.unit_price if entry.product else 0.0
        desc = f"Labor: {entry.product.name} ({entry.user_name})" if entry.product else f"Labor: General ({entry.user_name})"
        if entry.description: desc += f" - {entry.description}"
        desc += f" [Ref: Ticket #{ticket.id}]"
        line_total = hours * float(rate) # Temp float for buffer
        items_buffer.append({"description": desc, "quantity": round(hours, 2), "unit_price": rate, "total": round(line_total, 2), "ticket_id": ticket.id, "source_type": "time", "source_id": entry.id})

    for mat in ticket.materials:
        price = mat.product.unit_price if mat.product else 0.0
        name = f"Hardware: {mat.product.name}" if mat.product else "Hardware: Unidentified"
        name += f" [Ref: Ticket #{ticket.id}]"
        line_total = mat.quantity * float(price)
        items_buffer.append({"description": name, "quantity": float(mat.quantity), "unit_price": price, "total": round(line_total, 2), "ticket_id": ticket.id, "source_type": "material", "source_id": mat.id})

    if not items_buffer: raise HTTPException(status_code=400, detail="No billable items.")

    # Create Invoice shell
    new_invoice = models.Invoice(
        account_id=ticket.account_id, status="draft", 
        due_date=datetime.now() + timedelta(days=14), generated_at=func.now()
    )
    db.add(new_invoice)
    db.flush()

    for item in items_buffer:
        db.add(models.InvoiceItem(invoice_id=new_invoice.id, **item))

    db.commit()
    
    # Trigger Recalculate to do the Decimal Math
    return recalculate_invoice(new_invoice.id, db)

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
    inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not inv: raise HTTPException(status_code=404, detail="Invoice not found")
    if update.status: inv.status = update.status
    if update.due_date: inv.due_date = update.due_date
    if update.payment_terms: inv.payment_terms = update.payment_terms
    if update.generated_at: inv.generated_at = update.generated_at
    if update.due_date or update.generated_at or update.payment_terms: inv.pdf_path = None
    db.commit()
    db.refresh(inv)
    inv.account_name = inv.account.name
    return inv

@router.delete("/{invoice_id}")
def delete_invoice(invoice_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    # 1. PERMISSION GUARD
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only Admins can delete invoices.")

    inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not inv: 
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # 2. STATUS GUARD (The Strict Rule)
    if inv.status != 'draft':
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete invoice in '{inv.status}' status. Only drafts can be deleted."
        )

    # 3. RELEASE LOGIC (Implicit via Cascade)
    # Deleting the invoice deletes the items. 
    # Tickets referencing these items will simply stop seeing them in 'related_invoices'.
    
    db.delete(inv)
    db.commit()
    return {"status": "deleted", "id": invoice_id}

@router.post("/{invoice_id}/items", response_model=schemas.InvoiceResponse)
def add_invoice_item(invoice_id: str, item: schemas.InvoiceItemCreate, db: Session = Depends(get_db)):
    # Using Decimal/Numeric logic via DB
    new_item = models.InvoiceItem(
        invoice_id=invoice_id, description=item.description, quantity=item.quantity, unit_price=item.unit_price,
        total=round(item.quantity * item.unit_price, 2) # Temp calc, recalculate fixes it
    )
    db.add(new_item)
    db.commit()
    return recalculate_invoice(invoice_id, db)

@router.put("/items/{item_id}", response_model=schemas.InvoiceResponse)
def update_invoice_item(item_id: str, update: schemas.InvoiceItemUpdate, db: Session = Depends(get_db)):
    item = db.query(models.InvoiceItem).filter(models.InvoiceItem.id == item_id).first()
    if not item: raise HTTPException(status_code=404, detail="Item not found")
    if update.description is not None: item.description = update.description
    if update.quantity is not None: item.quantity = update.quantity
    if update.unit_price is not None: item.unit_price = update.unit_price
    item.total = round(item.quantity * item.unit_price, 2)
    db.commit()
    return recalculate_invoice(item.invoice_id, db)

@router.delete("/items/{item_id}", response_model=schemas.InvoiceResponse)
def delete_invoice_item(item_id: str, db: Session = Depends(get_db)):
    item = db.query(models.InvoiceItem).filter(models.InvoiceItem.id == item_id).first()
    if not item: raise HTTPException(status_code=404, detail="Item not found")
    pid = item.invoice_id
    db.delete(item)
    db.commit()
    return recalculate_invoice(pid, db)

@router.put("/{invoice_id}/void", response_model=schemas.InvoiceResponse)
def void_invoice(invoice_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    # 1. PERMISSION GUARD
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only Admins can void invoices.")

    inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not inv: 
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # 2. STATUS GUARD
    if inv.status == 'paid':
        raise HTTPException(status_code=400, detail="Cannot void a Paid invoice. Issue a Credit Note instead.")
    if inv.status == 'void':
        raise HTTPException(status_code=400, detail="Invoice is already void.")

    # 3. RELEASE LOGIC (The Critical Step)
    # We strip the source_id and source_type from the line items.
    # This keeps the text on the Void Invoice, but tells the Ticket it is no longer billed.
    for item in inv.items:
        item.source_id = None
        item.source_type = None
        # We keep description/price for historical record of what WAS on the voided invoice
    
    # 4. ZEROIZE & UPDATE
    inv.status = 'void'
    inv.subtotal_amount = 0
    inv.gst_amount = 0
    inv.total_amount = 0
    
    db.commit()
    db.refresh(inv)
    return inv

@router.post("/{invoice_id}/send")
def send_invoice_email(invoice_id: str, request: schemas.InvoiceSendRequest, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not inv: raise HTTPException(status_code=404, detail="Invoice not found")

    abs_path = ""
    # Safe path handling
    cwd = os.getcwd()
    # In router, cwd might be root. Logic: app/static/reports/
    static_dir = os.path.join(cwd, "app/static/reports")
    if not os.path.exists(static_dir): os.makedirs(static_dir)

    if not inv.pdf_path or not os.path.exists(os.path.join(cwd, "app", inv.pdf_path.lstrip("/"))):
        data = {
            "id": str(inv.id), "client_name": inv.account.name, "date": str(inv.generated_at.date()),
            "subtotal": inv.subtotal_amount, "gst": inv.gst_amount, "total": inv.total_amount,
            "payment_terms": inv.payment_terms,
            "items": [{"desc": i.description, "qty": i.quantity, "price": i.unit_price, "total": i.total} for i in inv.items]
        }
        pdf = pdf_engine.generate_invoice_pdf(data)
        filename = f"invoice_{inv.id}.pdf"
        abs_path = os.path.join(static_dir, filename)
        pdf.output(abs_path)
        inv.pdf_path = f"/static/reports/{filename}"
        db.commit()
    else:
        abs_path = os.path.join(cwd, "app", inv.pdf_path.lstrip("/"))

    html_body = request.message or f"<p>Please find attached invoice #{str(inv.id)[:8]}.</p>"
    if "\n" in html_body and "<p>" not in html_body: html_body = html_body.replace("\n", "<br>")
    
    success = email_service.send(to_emails=[request.to_email], subject=request.subject or "Invoice", html_content=html_body, cc_emails=request.cc_emails, attachments=[abs_path])
    if not success: raise HTTPException(status_code=500, detail="Email failed")
    
    db.add(models.InvoiceDeliveryLog(invoice_id=inv.id, sent_by_user_id=current_user.id, sent_to=request.to_email, sent_cc=",".join(request.cc_emails), status="sent"))
    inv.status = 'sent'
    db.commit()
    return {"status": "sent"}
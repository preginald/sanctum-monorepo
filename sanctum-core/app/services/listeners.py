from fastapi import BackgroundTasks
from .email_service import email_service
from .. import models

def on_ticket_created(ticket: models.Ticket, background_tasks: BackgroundTasks):
    """
    Notify Admins when a Client creates a ticket.
    """
    # Only notify if created by a client (Account logic usually handled in router, 
    # but here we just check if it's a new ticket)
    
    # We can refine logic: If created by Client -> Notify Admin. 
    # If created by Admin -> Notify Client? 
    # For now, let's keep the existing logic: Admin Notification.
    
    subject = f"New Ticket #{ticket.id}: {ticket.subject}"
    body = f"""
    <h1>New Ticket Created</h1>
    <p><strong>Client:</strong> {ticket.account_name}</p>
    <p><strong>Subject:</strong> {ticket.subject}</p>
    <p><strong>Priority:</strong> {ticket.priority}</p>
    <p><a href="https://core.digitalsanctum.com.au/tickets/{ticket.id}">View Ticket</a></p>
    """
    
    # Send to Admin Email
    background_tasks.add_task(
        email_service.send, 
        email_service.admin_email, 
        subject, 
        body
    )

def on_ticket_resolved(ticket: models.Ticket, background_tasks: BackgroundTasks):
    """
    Notify the Client/Reporter when a ticket is resolved.
    """
    # We need to find who to email. 
    # 1. Primary Contact of Account? 
    # 2. Or specific contact linked to ticket?
    
    recipients = []
    
    # If specific contacts are linked, notify them
    if ticket.contacts:
        recipients = [c.email for c in ticket.contacts if c.email]
    
    # Fallback: Account Billing Email? Maybe not for tech support.
    
    if recipients:
        subject = f"Ticket #{ticket.id} Resolved: {ticket.subject}"
        body = f"""
        <h1>Ticket Resolved</h1>
        <p>The following ticket has been marked as <strong>Resolved</strong>.</p>
        <p><strong>Resolution:</strong></p>
        <blockquote>{ticket.resolution}</blockquote>
        <p>If you have further issues, please reply to this email.</p>
        """
        
        background_tasks.add_task(
            email_service.send,
            recipients,
            subject,
            body
        )
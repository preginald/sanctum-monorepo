"""
Centralised ticket query builder.

All ticket endpoints that return TicketResponse should use base_ticket_query()
to ensure joinedload chains stay in sync with the schema. When a new relationship
is added to TicketResponse, update TICKET_RESPONSE_OPTIONS here — not in every endpoint.
"""
from sqlalchemy.orm import Session, joinedload
from .. import models
from .ticket_validation import get_available_transitions


# Every joinedload required by schemas.TicketResponse lives here.
TICKET_RESPONSE_OPTIONS = (
    joinedload(models.Ticket.account),
    joinedload(models.Ticket.contacts),
    joinedload(models.Ticket.milestone).joinedload(models.Milestone.project),
    joinedload(models.Ticket.comments).joinedload(models.Comment.author),
    joinedload(models.Ticket.time_entries).joinedload(models.TicketTimeEntry.user),
    joinedload(models.Ticket.time_entries).joinedload(models.TicketTimeEntry.product),
    joinedload(models.Ticket.time_entries).joinedload(models.TicketTimeEntry.invoice),
    joinedload(models.Ticket.materials).joinedload(models.TicketMaterial.product),
    joinedload(models.Ticket.materials).joinedload(models.TicketMaterial.invoice),
    joinedload(models.Ticket.articles),
    joinedload(models.Ticket.assets),
)


def base_ticket_query(db: Session):
    """Return a Ticket query pre-loaded with all TicketResponse relationships."""
    return db.query(models.Ticket).options(*TICKET_RESPONSE_OPTIONS)


def enrich_ticket_response(ticket, db: Session) -> dict:
    """
    Build a dict from a fully-loaded Ticket ORM object that is ready
    for schemas.TicketResponse serialisation.

    Handles: account_name, milestone_name, project_id/name,
    comment author_name, time_entry/material invoice_status,
    total_hours, related_invoices, available_transitions.
    """
    t_dict = ticket.__dict__.copy()

    # Account
    t_dict['account_name'] = ticket.account.name if ticket.account else None

    # Milestone / Project
    if ticket.milestone:
        t_dict['milestone_name'] = ticket.milestone.name
        if ticket.milestone.project:
            t_dict['project_id'] = ticket.milestone.project.id
            t_dict['project_name'] = ticket.milestone.project.name

    # Comments — inject author_name
    for c in ticket.comments:
        c.author_name = c.author.full_name if c.author else "Unknown"

    # Time entries — inject invoice_status
    enriched_time = []
    for te in ticket.time_entries:
        if te.invoice:
            setattr(te, 'invoice_status', te.invoice.status)
        enriched_time.append(te)
    t_dict['time_entries'] = enriched_time

    # Materials — inject invoice_status
    enriched_materials = []
    for tm in ticket.materials:
        if tm.invoice:
            setattr(tm, 'invoice_status', tm.invoice.status)
        enriched_materials.append(tm)
    t_dict['materials'] = enriched_materials

    # Eagerly-loaded collections
    t_dict['contacts'] = ticket.contacts
    t_dict['articles'] = ticket.articles
    t_dict['assets'] = ticket.assets
    t_dict['total_hours'] = ticket.total_hours

    # Related invoices (via InvoiceItem join)
    linked_items = db.query(models.InvoiceItem).options(
        joinedload(models.InvoiceItem.invoice)
    ).filter(models.InvoiceItem.ticket_id == ticket.id).all()
    unique_invoices = {}
    for item in linked_items:
        if item.invoice:
            unique_invoices[item.invoice.id] = item.invoice
    t_dict['related_invoices'] = list(unique_invoices.values())

    # Transitions
    t_dict['available_transitions'] = get_available_transitions(ticket.status)

    return t_dict

"""Unit tests for workbench summary logic (#2680).

Tests:
- Health colour: green (active, recent), amber (pending tickets / 3-7d stale), red (7+d stale / overdue)
- Current/next ticket selection by milestone sequence then ticket id
- Progress computation (resolved / total)
- Status filter parsing (comma-separated)
"""

import pytest
from uuid import uuid4
from datetime import datetime, timezone, timedelta, date


# ---------------------------------------------------------------------------
# Stubs
# ---------------------------------------------------------------------------

class FakeMilestone:
    def __init__(self, id=None, sequence=1, status="active", due_date=None, name="Milestone"):
        self.id = id or uuid4()
        self.sequence = sequence
        self.status = status
        self.due_date = due_date
        self.name = name
        self.is_deleted = False


class FakeTicket:
    def __init__(self, id=1, milestone_id=None, status="new", subject="Test ticket",
                 updated_at=None, created_at=None):
        self.id = id
        self.milestone_id = milestone_id
        self.status = status
        self.subject = subject
        self.updated_at = updated_at
        self.created_at = created_at or datetime.now(timezone.utc)
        self.is_deleted = False


# ---------------------------------------------------------------------------
# Pure-logic helpers mirroring workbench.py endpoint logic
# ---------------------------------------------------------------------------

RESOLVED_STATUSES = {"resolved"}
PENDING_STATUSES = {"pending"}


def compute_health(tickets, last_activity_at, milestones):
    """Mirror of _compute_health from workbench router."""
    now = datetime.now(timezone.utc)

    has_pending = any(t.status in PENDING_STATUSES for t in tickets)
    overdue_milestones = [
        m for m in milestones
        if m.due_date and m.status != "completed"
        and datetime.combine(m.due_date, datetime.min.time()).replace(tzinfo=timezone.utc) < now
    ]

    if last_activity_at:
        days_stale = (now - last_activity_at).days
    else:
        days_stale = 999

    if days_stale >= 7:
        return "red"
    if overdue_milestones:
        return "red"
    if has_pending:
        return "amber"
    if days_stale >= 3:
        return "amber"
    return "green"


def find_current_next_tickets(tickets, milestones):
    """Mirror of current/next ticket logic from workbench summary endpoint."""
    milestone_map = {m.id: m.sequence for m in milestones}
    open_tickets = []
    for t in tickets:
        if t.status not in RESOLVED_STATUSES:
            ms_seq = milestone_map.get(t.milestone_id, 999)
            open_tickets.append((ms_seq, t.id, t))
    open_tickets.sort(key=lambda x: (x[0], x[1]))

    current = open_tickets[0][2] if open_tickets else None
    next_t = open_tickets[1][2] if len(open_tickets) > 1 else None
    return current, next_t


def compute_progress(tickets):
    """Compute resolved/total progress."""
    total = len(tickets)
    resolved = sum(1 for t in tickets if t.status in RESOLVED_STATUSES)
    return resolved, total


def parse_status_filter(status_param):
    """Parse comma-separated status filter."""
    if not status_param:
        return []
    return [s.strip() for s in status_param.split(",") if s.strip()]


# ---------------------------------------------------------------------------
# Tests: Health Colour
# ---------------------------------------------------------------------------

class TestHealthColour:
    def test_green_active_recent(self):
        """No blockers, activity within 3 days = green."""
        ms = FakeMilestone()
        ticket = FakeTicket(milestone_id=ms.id, status="implementation")
        last_activity = datetime.now(timezone.utc) - timedelta(hours=12)
        assert compute_health([ticket], last_activity, [ms]) == "green"

    def test_amber_pending_ticket(self):
        """Any ticket in pending status = amber."""
        ms = FakeMilestone()
        tickets = [
            FakeTicket(id=1, milestone_id=ms.id, status="implementation"),
            FakeTicket(id=2, milestone_id=ms.id, status="pending"),
        ]
        last_activity = datetime.now(timezone.utc) - timedelta(hours=1)
        assert compute_health(tickets, last_activity, [ms]) == "amber"

    def test_amber_stale_3_to_7_days(self):
        """No activity for 3-7 days = amber."""
        ms = FakeMilestone()
        ticket = FakeTicket(milestone_id=ms.id, status="new")
        last_activity = datetime.now(timezone.utc) - timedelta(days=5)
        assert compute_health([ticket], last_activity, [ms]) == "amber"

    def test_red_stale_7_plus_days(self):
        """No activity for 7+ days = red."""
        ms = FakeMilestone()
        ticket = FakeTicket(milestone_id=ms.id, status="new")
        last_activity = datetime.now(timezone.utc) - timedelta(days=10)
        assert compute_health([ticket], last_activity, [ms]) == "red"

    def test_red_overdue_milestone(self):
        """Milestone past due_date = red."""
        ms = FakeMilestone(due_date=date.today() - timedelta(days=3), status="active")
        ticket = FakeTicket(milestone_id=ms.id, status="new")
        last_activity = datetime.now(timezone.utc) - timedelta(hours=1)
        assert compute_health([ticket], last_activity, [ms]) == "red"

    def test_completed_milestone_not_overdue(self):
        """Completed milestones should not trigger overdue even if past due_date."""
        ms = FakeMilestone(due_date=date.today() - timedelta(days=3), status="completed")
        ticket = FakeTicket(milestone_id=ms.id, status="resolved")
        last_activity = datetime.now(timezone.utc) - timedelta(hours=1)
        assert compute_health([ticket], last_activity, [ms]) == "green"

    def test_no_activity_at_all(self):
        """No last_activity_at = red (999 days stale)."""
        ms = FakeMilestone()
        ticket = FakeTicket(milestone_id=ms.id, status="new")
        assert compute_health([ticket], None, [ms]) == "red"


# ---------------------------------------------------------------------------
# Tests: Current/Next Ticket
# ---------------------------------------------------------------------------

class TestCurrentNextTicket:
    def test_single_open_ticket(self):
        ms = FakeMilestone(sequence=1)
        ticket = FakeTicket(id=100, milestone_id=ms.id, status="recon")
        current, next_t = find_current_next_tickets([ticket], [ms])
        assert current.id == 100
        assert next_t is None

    def test_two_tickets_same_milestone(self):
        ms = FakeMilestone(sequence=1)
        t1 = FakeTicket(id=10, milestone_id=ms.id, status="implementation")
        t2 = FakeTicket(id=20, milestone_id=ms.id, status="new")
        current, next_t = find_current_next_tickets([t1, t2], [ms])
        assert current.id == 10
        assert next_t.id == 20

    def test_cross_milestone_ordering(self):
        """Current ticket from milestone 1, next from milestone 2."""
        ms1 = FakeMilestone(sequence=1)
        ms2 = FakeMilestone(sequence=2)
        t1 = FakeTicket(id=5, milestone_id=ms1.id, status="recon")
        t2 = FakeTicket(id=3, milestone_id=ms2.id, status="new")
        current, next_t = find_current_next_tickets([t1, t2], [ms1, ms2])
        assert current.id == 5  # ms1 sequence=1
        assert next_t.id == 3   # ms2 sequence=2

    def test_resolved_tickets_excluded(self):
        ms = FakeMilestone(sequence=1)
        t1 = FakeTicket(id=1, milestone_id=ms.id, status="resolved")
        t2 = FakeTicket(id=2, milestone_id=ms.id, status="new")
        current, next_t = find_current_next_tickets([t1, t2], [ms])
        assert current.id == 2
        assert next_t is None

    def test_all_resolved_returns_none(self):
        ms = FakeMilestone(sequence=1)
        t1 = FakeTicket(id=1, milestone_id=ms.id, status="resolved")
        current, next_t = find_current_next_tickets([t1], [ms])
        assert current is None
        assert next_t is None


# ---------------------------------------------------------------------------
# Tests: Progress
# ---------------------------------------------------------------------------

class TestProgress:
    def test_basic_progress(self):
        tickets = [
            FakeTicket(id=1, status="resolved"),
            FakeTicket(id=2, status="resolved"),
            FakeTicket(id=3, status="new"),
        ]
        resolved, total = compute_progress(tickets)
        assert resolved == 2
        assert total == 3

    def test_empty_tickets(self):
        resolved, total = compute_progress([])
        assert resolved == 0
        assert total == 0

    def test_all_resolved(self):
        tickets = [FakeTicket(id=i, status="resolved") for i in range(5)]
        resolved, total = compute_progress(tickets)
        assert resolved == 5
        assert total == 5


# ---------------------------------------------------------------------------
# Tests: Status Filter
# ---------------------------------------------------------------------------

class TestStatusFilter:
    def test_single_status(self):
        assert parse_status_filter("active") == ["active"]

    def test_comma_separated(self):
        assert parse_status_filter("active,planning") == ["active", "planning"]

    def test_with_spaces(self):
        assert parse_status_filter("active, planning , on_hold") == ["active", "planning", "on_hold"]

    def test_empty_string(self):
        assert parse_status_filter("") == []

    def test_none(self):
        assert parse_status_filter(None) == []

    def test_trailing_comma(self):
        assert parse_status_filter("active,") == ["active"]

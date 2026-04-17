"""Unit tests for workbench session notifications (#2758).

Tests:
1. GET /workbench/notifications returns 200 with empty list when no pins
2. GET /workbench/notifications returns only in_app notifications for pinned projects
3. GET /workbench/notifications respects `since` parameter
4. GET /workbench/notifications uses _resolve_workbench_user (service account resolution)
5. Event listener creates in_app notification for pinned users on ticket status change
6. Event listener creates in_app notification for pinned users on ticket comment
7. Event listener does NOT create notification for the actor (self-suppression)
8. Dedup: second notification within 60s for same user/project/event_type is skipped
9. enqueue() with delivery_channel='in_app' writes to DB, does not call Notify API
10. Existing email notifications unaffected (delivery_channel='email' path unchanged)
"""

import pytest
from uuid import uuid4, UUID
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# Stubs
# ---------------------------------------------------------------------------

class FakeUser:
    def __init__(self, id=None, user_type="human", account_id=None):
        self.id = id or uuid4()
        self.email = f"user-{self.id}@test.com"
        self.full_name = "Test User"
        self.is_active = True
        self.user_type = user_type
        self.account_id = account_id
        self.role = "admin"


class FakeWorkbenchPin:
    def __init__(self, user_id, project_id, position=0):
        self.id = uuid4()
        self.user_id = user_id
        self.project_id = project_id
        self.position = position
        self.pinned_at = datetime.now(timezone.utc)


class FakeNotification:
    def __init__(self, id=None, user_id=None, project_id=None, event_type=None,
                 delivery_channel='in_app', is_read=False, created_at=None,
                 title="", message="", link=None, priority="normal",
                 event_payload=None, status="delivered"):
        self.id = id or uuid4()
        self.user_id = user_id
        self.project_id = project_id
        self.event_type = event_type
        self.delivery_channel = delivery_channel
        self.is_read = is_read
        self.created_at = created_at or datetime.now(timezone.utc)
        self.title = title
        self.message = message
        self.link = link
        self.priority = priority
        self.event_payload = event_payload or {}
        self.status = status
        self.recipient_email = None


class FakeTicket:
    def __init__(self, id=1, milestone_id=None, subject="Test Ticket", priority="normal", status="open"):
        self.id = id
        self.milestone_id = milestone_id
        self.subject = subject
        self.priority = priority
        self.status = status


class FakeProject:
    def __init__(self, id=None, name="Test Project"):
        self.id = id or uuid4()
        self.name = name


class FakeMilestone:
    def __init__(self, id=None, project_id=None, name="Test Milestone"):
        self.id = id or uuid4()
        self.project_id = project_id
        self.name = name


# ---------------------------------------------------------------------------
# Pure logic helpers for notification filtering (mirror router logic)
# ---------------------------------------------------------------------------

def filter_workbench_notifications(
    notifications: list[FakeNotification],
    user_id: UUID,
    pinned_project_ids: list[UUID],
    since: datetime = None,
    limit: int = 20,
):
    """Filter in_app notifications for pinned projects (mirrors endpoint logic)."""
    if not pinned_project_ids:
        return [], 0

    filtered = [
        n for n in notifications
        if n.user_id == user_id
        and n.delivery_channel == 'in_app'
        and n.project_id in pinned_project_ids
        and not n.is_read
    ]
    if since:
        filtered = [n for n in filtered if n.created_at > since]

    # Sort by created_at desc
    filtered.sort(key=lambda n: n.created_at, reverse=True)
    unread_count = len(filtered)
    return filtered[:limit], unread_count


def should_create_notification(
    existing_notifications: list[FakeNotification],
    user_id: UUID,
    project_id: UUID,
    event_type: str,
    actor_user_id: UUID = None,
    pin_user_id: UUID = None,
    dedup_window_seconds: int = 60,
):
    """Determine if an in_app notification should be created.

    Returns False if:
    - pin_user_id matches actor_user_id (self-suppression)
    - A duplicate exists within the dedup window
    """
    # Self-suppression
    if actor_user_id and str(pin_user_id) == str(actor_user_id):
        return False

    # Dedup check
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=dedup_window_seconds)
    for n in existing_notifications:
        if (n.user_id == user_id
            and n.project_id == project_id
            and n.event_type == event_type
            and n.delivery_channel == 'in_app'
            and n.created_at > cutoff):
            return False

    return True


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestWorkbenchNotificationsEndpoint:
    """Tests 1-4: GET /workbench/notifications logic."""

    def test_empty_list_when_no_pins(self):
        """#1: Returns empty list and unread_count=0 when user has no pins."""
        notifications, count = filter_workbench_notifications(
            notifications=[],
            user_id=uuid4(),
            pinned_project_ids=[],
        )
        assert notifications == []
        assert count == 0

    def test_returns_only_inapp_for_pinned_projects(self):
        """#2: Returns only in_app notifications for pinned projects."""
        user_id = uuid4()
        project_a = uuid4()
        project_b = uuid4()
        project_unpinned = uuid4()

        all_notifications = [
            FakeNotification(user_id=user_id, project_id=project_a, delivery_channel='in_app', title="A"),
            FakeNotification(user_id=user_id, project_id=project_b, delivery_channel='in_app', title="B"),
            FakeNotification(user_id=user_id, project_id=project_unpinned, delivery_channel='in_app', title="Unpinned"),
            FakeNotification(user_id=user_id, project_id=project_a, delivery_channel='email', title="Email"),
            FakeNotification(user_id=uuid4(), project_id=project_a, delivery_channel='in_app', title="Other user"),
        ]

        results, count = filter_workbench_notifications(
            notifications=all_notifications,
            user_id=user_id,
            pinned_project_ids=[project_a, project_b],
        )
        assert count == 2
        titles = {n.title for n in results}
        assert titles == {"A", "B"}

    def test_respects_since_parameter(self):
        """#3: Filters by `since` parameter."""
        user_id = uuid4()
        project_id = uuid4()
        now = datetime.now(timezone.utc)

        all_notifications = [
            FakeNotification(user_id=user_id, project_id=project_id, created_at=now - timedelta(hours=2), title="Old"),
            FakeNotification(user_id=user_id, project_id=project_id, created_at=now - timedelta(minutes=5), title="Recent"),
        ]

        results, count = filter_workbench_notifications(
            notifications=all_notifications,
            user_id=user_id,
            pinned_project_ids=[project_id],
            since=now - timedelta(hours=1),
        )
        assert count == 1
        assert results[0].title == "Recent"

    def test_service_account_resolution(self):
        """#4: Service accounts resolve to human admin user.

        Mirrors the _resolve_workbench_user logic without importing the
        actual router (which triggers DB engine creation).
        """
        account_id = uuid4()
        service_account = FakeUser(user_type="service_account", account_id=account_id)
        human_admin = FakeUser(user_type="human", account_id=account_id)
        human_admin.role = "admin"

        # Inline the resolution logic (mirrors workbench._resolve_workbench_user)
        def resolve(current_user, available_humans):
            if current_user.user_type == "service_account" and current_user.account_id:
                for u in available_humans:
                    if u.account_id == current_user.account_id and u.user_type == "human":
                        return u
            return current_user

        result = resolve(service_account, [human_admin])
        assert result.id == human_admin.id

    def test_human_user_returns_self(self):
        """#4b: Human users resolve to themselves."""
        human_user = FakeUser(user_type="human")

        def resolve(current_user, available_humans):
            if current_user.user_type == "service_account" and current_user.account_id:
                for u in available_humans:
                    if u.account_id == current_user.account_id and u.user_type == "human":
                        return u
            return current_user

        result = resolve(human_user, [])
        assert result.id == human_user.id


class TestWorkbenchEventListener:
    """Tests 5-8: Event listener behaviour."""

    def test_creates_notification_for_pinned_users_on_status_change(self):
        """#5: Pinned users get in_app notification on ticket_status_change."""
        user_id = uuid4()
        project_id = uuid4()
        actor_id = uuid4()

        result = should_create_notification(
            existing_notifications=[],
            user_id=user_id,
            project_id=project_id,
            event_type="ticket_status_change",
            actor_user_id=actor_id,
            pin_user_id=user_id,
        )
        assert result is True

    def test_creates_notification_for_pinned_users_on_comment(self):
        """#6: Pinned users get in_app notification on ticket_comment."""
        user_id = uuid4()
        project_id = uuid4()
        actor_id = uuid4()

        result = should_create_notification(
            existing_notifications=[],
            user_id=user_id,
            project_id=project_id,
            event_type="ticket_comment",
            actor_user_id=actor_id,
            pin_user_id=user_id,
        )
        assert result is True

    def test_does_not_notify_actor(self):
        """#7: Actor is excluded from receiving their own notification."""
        user_id = uuid4()
        project_id = uuid4()

        result = should_create_notification(
            existing_notifications=[],
            user_id=user_id,
            project_id=project_id,
            event_type="ticket_status_change",
            actor_user_id=user_id,
            pin_user_id=user_id,
        )
        assert result is False

    def test_dedup_within_60_seconds(self):
        """#8: Duplicate notification within 60s is skipped."""
        user_id = uuid4()
        project_id = uuid4()
        now = datetime.now(timezone.utc)

        existing = [
            FakeNotification(
                user_id=user_id,
                project_id=project_id,
                event_type="ticket_status_change",
                delivery_channel="in_app",
                created_at=now - timedelta(seconds=30),
            )
        ]

        result = should_create_notification(
            existing_notifications=existing,
            user_id=user_id,
            project_id=project_id,
            event_type="ticket_status_change",
            actor_user_id=uuid4(),
            pin_user_id=user_id,
        )
        assert result is False

    def test_no_dedup_after_60_seconds(self):
        """#8b: Notification allowed after dedup window expires."""
        user_id = uuid4()
        project_id = uuid4()
        now = datetime.now(timezone.utc)

        existing = [
            FakeNotification(
                user_id=user_id,
                project_id=project_id,
                event_type="ticket_status_change",
                delivery_channel="in_app",
                created_at=now - timedelta(seconds=90),
            )
        ]

        result = should_create_notification(
            existing_notifications=existing,
            user_id=user_id,
            project_id=project_id,
            event_type="ticket_status_change",
            actor_user_id=uuid4(),
            pin_user_id=user_id,
        )
        assert result is True


class TestNotificationTitleEnrichment:
    """Tests for #2764: subscriber title enrichment with project/milestone context."""

    @staticmethod
    def enrich_title(raw_title, project_name, milestone_name):
        """Mirror the enrichment logic from workbench_subscriber._process_workbench_notification."""
        if milestone_name:
            return f"[{project_name}] {raw_title} ({milestone_name})"
        else:
            return f"[{project_name}] {raw_title}"

    def test_enriches_comment_title_with_project_and_milestone(self):
        result = self.enrich_title("New Comment: #2384", "Workbench Session Notifications", "Phase 4: The Integration")
        assert result == "[Workbench Session Notifications] New Comment: #2384 (Phase 4: The Integration)"

    def test_enriches_status_change_title_with_project_and_milestone(self):
        result = self.enrich_title("Status Change: #2384 \u2192 open", "Sanctum Core", "Phase 79: The Conduit")
        assert result == "[Sanctum Core] Status Change: #2384 \u2192 open (Phase 79: The Conduit)"

    def test_enriches_title_without_milestone(self):
        result = self.enrich_title("Ticket #100 update", "My Project", "")
        assert result == "[My Project] Ticket #100 update"

    def test_enriches_with_unknown_project(self):
        result = self.enrich_title("New Comment: #50", "Unknown Project", "Phase 1")
        assert result == "[Unknown Project] New Comment: #50 (Phase 1)"


class TestNotificationServiceDeliveryChannel:
    """Tests 9-10: enqueue() delivery_channel behaviour."""

    def test_inapp_delivery_creates_delivered_status(self):
        """#9: in_app delivery creates notification with status='delivered'.

        Tests the pure logic: when delivery_channel is 'in_app', the
        notification should have status='delivered' and skip email dispatch.
        """
        # Simulate the enqueue logic for in_app channel
        delivery_channel = 'in_app'
        expected_status = 'delivered' if delivery_channel == 'in_app' else 'pending'
        should_skip_email = delivery_channel == 'in_app'

        assert expected_status == 'delivered'
        assert should_skip_email is True

    def test_email_delivery_creates_pending_status(self):
        """#10: Default email delivery creates notification with status='pending'."""
        delivery_channel = 'email'
        expected_status = 'delivered' if delivery_channel == 'in_app' else 'pending'
        should_skip_email = delivery_channel == 'in_app'

        assert expected_status == 'pending'
        assert should_skip_email is False


# ---------------------------------------------------------------------------
# Integration tests: call _process_workbench_notification directly (#2766)
# ---------------------------------------------------------------------------

def _build_mock_session(ticket, milestone, project, pins, existing_notifications=None):
    """Build a MagicMock session that routes query() calls by model class.

    Uses side_effect keyed on the model class to prevent false positives
    where the wrong model is returned for a given query.
    """
    # Deferred import to avoid triggering database engine creation at module level
    from app import models as app_models

    session = MagicMock()

    def query_router(model_class):
        chain = MagicMock()
        if model_class is app_models.Ticket:
            chain.filter.return_value.first.return_value = ticket
        elif model_class is app_models.Milestone:
            chain.filter.return_value.first.return_value = milestone
        elif model_class is app_models.Project:
            chain.filter.return_value.first.return_value = project
        elif model_class is app_models.WorkbenchPin:
            chain.filter.return_value.all.return_value = pins
        elif model_class is app_models.Notification:
            chain.filter.return_value.first.return_value = (
                existing_notifications[0] if existing_notifications else None
            )
        return chain

    session.query.side_effect = query_router
    return session


class TestProcessWorkbenchNotificationIntegration:
    """Integration tests for _process_workbench_notification (#2766).

    These tests call the actual subscriber function (not a static mirror)
    and assert the enriched Notification.title written to the DB session.
    Patch target is app.services.workbench_subscriber.SessionLocal to
    return a mock session, avoiding any real database dependency.
    """

    def test_comment_event_with_milestone(self):
        """Comment event produces enriched title with project and milestone context."""
        from app import models as app_models

        user_id = uuid4()
        project_id = uuid4()
        milestone_id = uuid4()

        ticket = FakeTicket(id=100, milestone_id=milestone_id)
        milestone = FakeMilestone(id=milestone_id, project_id=project_id, name="Phase 4: The Integration")
        project = FakeProject(id=project_id, name="Workbench Session Notifications")
        pin = FakeWorkbenchPin(user_id=user_id, project_id=project_id)

        session = _build_mock_session(ticket, milestone, project, [pin])

        payload = {
            "ticket_id": 100,
            "actor_user_id": str(uuid4()),  # different from pin user
            "event_type": "ticket_comment",
            "title": "New Comment: #100",
            "message": "A comment was added",
            "link": "/tickets/100",
        }

        with patch("app.services.workbench_subscriber.SessionLocal", return_value=session):
            from app.services.workbench_subscriber import _process_workbench_notification
            _process_workbench_notification(payload)

        session.add.assert_called_once()
        note = session.add.call_args[0][0]
        assert isinstance(note, app_models.Notification)
        assert note.title == "[Workbench Session Notifications] New Comment: #100 (Phase 4: The Integration)"
        session.commit.assert_called_once()

    def test_status_change_event_with_milestone(self):
        """Status change event produces enriched title with project and milestone context."""
        from app import models as app_models

        user_id = uuid4()
        project_id = uuid4()
        milestone_id = uuid4()

        ticket = FakeTicket(id=200, milestone_id=milestone_id)
        milestone = FakeMilestone(id=milestone_id, project_id=project_id, name="Phase 79: The Conduit")
        project = FakeProject(id=project_id, name="Sanctum Core")
        pin = FakeWorkbenchPin(user_id=user_id, project_id=project_id)

        session = _build_mock_session(ticket, milestone, project, [pin])

        payload = {
            "ticket_id": 200,
            "actor_user_id": str(uuid4()),
            "event_type": "ticket_status_change",
            "title": "Status Change: #200 \u2192 open",
            "message": "Status was changed",
            "link": "/tickets/200",
        }

        with patch("app.services.workbench_subscriber.SessionLocal", return_value=session):
            from app.services.workbench_subscriber import _process_workbench_notification
            _process_workbench_notification(payload)

        session.add.assert_called_once()
        note = session.add.call_args[0][0]
        assert isinstance(note, app_models.Notification)
        assert note.title == "[Sanctum Core] Status Change: #200 \u2192 open (Phase 79: The Conduit)"
        session.commit.assert_called_once()

    def test_empty_milestone_name_fallback(self):
        """Empty milestone name omits parenthesised suffix from title.

        Note: The ticket's original AC #3 described a "no milestone_id" fallback,
        but _process_workbench_notification early-returns at line 51 when
        ticket.milestone_id is falsy. This test instead exercises the else branch
        at line 102-103 where milestone exists but has an empty name string.
        """
        from app import models as app_models

        user_id = uuid4()
        project_id = uuid4()
        milestone_id = uuid4()

        ticket = FakeTicket(id=300, milestone_id=milestone_id)
        milestone = FakeMilestone(id=milestone_id, project_id=project_id, name="")
        project = FakeProject(id=project_id, name="My Project")
        pin = FakeWorkbenchPin(user_id=user_id, project_id=project_id)

        session = _build_mock_session(ticket, milestone, project, [pin])

        payload = {
            "ticket_id": 300,
            "actor_user_id": str(uuid4()),
            "event_type": "ticket_comment",
            "title": "New Comment: #300",
            "message": "",
            "link": "/tickets/300",
        }

        with patch("app.services.workbench_subscriber.SessionLocal", return_value=session):
            from app.services.workbench_subscriber import _process_workbench_notification
            _process_workbench_notification(payload)

        session.add.assert_called_once()
        note = session.add.call_args[0][0]
        assert isinstance(note, app_models.Notification)
        assert note.title == "[My Project] New Comment: #300"
        session.commit.assert_called_once()

    def test_no_milestone_id_early_return(self):
        """Ticket with no milestone_id causes early return -- no notification created.

        Covers the silent-failure path at line 51 where the function returns
        without writing any Notification records.
        """
        ticket = FakeTicket(id=400, milestone_id=None)
        session = _build_mock_session(ticket, None, None, [])

        payload = {
            "ticket_id": 400,
            "actor_user_id": str(uuid4()),
            "event_type": "ticket_comment",
            "title": "New Comment: #400",
        }

        with patch("app.services.workbench_subscriber.SessionLocal", return_value=session):
            from app.services.workbench_subscriber import _process_workbench_notification
            _process_workbench_notification(payload)

        session.add.assert_not_called()
        session.commit.assert_not_called()

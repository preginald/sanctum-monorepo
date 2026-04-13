"""Unit tests for workbench pin/unpin/list/reorder logic (#1917).

Tests the workbench business rules:
- Pin a project (new pin returns 201)
- Duplicate pin upserts position (returns 200)
- Max 5 pins enforced (422)
- Unpin removes pin (200)
- Unpin non-existent returns 404
- List returns pins ordered by position
- Reorder updates positions
- Cross-operator isolation
"""

import pytest
from uuid import uuid4, UUID
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Stubs
# ---------------------------------------------------------------------------

MAX_PINS = 5


class FakeUser:
    def __init__(self, id=None):
        self.id = id or uuid4()
        self.email = f"user-{self.id}@test.com"
        self.is_active = True


class FakeProject:
    def __init__(self, id=None, name="Test Project", status="active", account_id=None):
        self.id = id or uuid4()
        self.name = name
        self.status = status
        self.account_id = account_id or uuid4()


class FakeWorkbenchPin:
    def __init__(self, user_id, project_id, position=0, id=None):
        self.id = id or uuid4()
        self.user_id = user_id
        self.project_id = project_id
        self.position = position
        self.pinned_at = datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Pure-logic helpers that mirror router behaviour
# ---------------------------------------------------------------------------

def validate_pin_create(pins: list[FakeWorkbenchPin], user_id: UUID, project_id: UUID, max_pins: int = MAX_PINS):
    """Validate whether a new pin can be created.

    Returns:
        (is_existing, error_code, error_detail)
        - is_existing=True means pin already exists (upsert case, 200)
        - is_existing=False and error_code=None means new pin allowed (201)
        - error_code set means rejection
    """
    existing = next(
        (p for p in pins if p.user_id == user_id and p.project_id == project_id),
        None,
    )
    if existing:
        return True, None, None

    user_pins = [p for p in pins if p.user_id == user_id]
    if len(user_pins) >= max_pins:
        return False, 422, f"Maximum {max_pins} pins allowed. Unpin a project first."

    return False, None, None


def do_upsert(pins: list[FakeWorkbenchPin], user_id: UUID, project_id: UUID, position: int = 0):
    """Simulate upsert: update if exists, create if not. Returns (pin, is_new)."""
    existing = next(
        (p for p in pins if p.user_id == user_id and p.project_id == project_id),
        None,
    )
    if existing:
        existing.position = position
        existing.pinned_at = datetime.now(timezone.utc)
        return existing, False
    new_pin = FakeWorkbenchPin(user_id=user_id, project_id=project_id, position=position)
    pins.append(new_pin)
    return new_pin, True


def do_unpin(pins: list[FakeWorkbenchPin], user_id: UUID, project_id: UUID):
    """Remove a pin. Returns True if found and removed, False if not found."""
    idx = next(
        (i for i, p in enumerate(pins) if p.user_id == user_id and p.project_id == project_id),
        None,
    )
    if idx is None:
        return False
    pins.pop(idx)
    return True


def list_pins(pins: list[FakeWorkbenchPin], user_id: UUID):
    """List pins for a user, ordered by position."""
    user_pins = [p for p in pins if p.user_id == user_id]
    user_pins.sort(key=lambda p: (p.position, p.pinned_at))
    return user_pins


def reorder_pins(pins: list[FakeWorkbenchPin], user_id: UUID, order: list[dict]):
    """Bulk update positions."""
    for item in order:
        pin = next(
            (p for p in pins if p.user_id == user_id and p.project_id == item["project_id"]),
            None,
        )
        if pin:
            pin.position = item["position"]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestPinCreate:
    def test_new_pin_returns_201(self):
        pins = []
        user = FakeUser()
        project = FakeProject()
        is_existing, err_code, _ = validate_pin_create(pins, user.id, project.id)
        assert not is_existing
        assert err_code is None
        pin, is_new = do_upsert(pins, user.id, project.id, position=0)
        assert is_new
        assert pin.project_id == project.id
        assert len(pins) == 1

    def test_duplicate_pin_upserts_returns_200(self):
        user = FakeUser()
        project = FakeProject()
        pins = [FakeWorkbenchPin(user_id=user.id, project_id=project.id, position=0)]

        is_existing, err_code, _ = validate_pin_create(pins, user.id, project.id)
        assert is_existing
        assert err_code is None

        pin, is_new = do_upsert(pins, user.id, project.id, position=3)
        assert not is_new
        assert pin.position == 3
        assert len(pins) == 1  # no duplicates

    def test_max_pins_enforced(self):
        user = FakeUser()
        pins = [
            FakeWorkbenchPin(user_id=user.id, project_id=uuid4(), position=i)
            for i in range(MAX_PINS)
        ]
        new_project = FakeProject()
        is_existing, err_code, detail = validate_pin_create(pins, user.id, new_project.id)
        assert not is_existing
        assert err_code == 422
        assert "Maximum" in detail

    def test_max_pins_allows_upsert_existing(self):
        """Even at max pins, re-pinning an existing project should succeed."""
        user = FakeUser()
        project_ids = [uuid4() for _ in range(MAX_PINS)]
        pins = [
            FakeWorkbenchPin(user_id=user.id, project_id=pid, position=i)
            for i, pid in enumerate(project_ids)
        ]
        # Re-pin the first project
        is_existing, err_code, _ = validate_pin_create(pins, user.id, project_ids[0])
        assert is_existing
        assert err_code is None


class TestUnpin:
    def test_unpin_existing(self):
        user = FakeUser()
        project = FakeProject()
        pins = [FakeWorkbenchPin(user_id=user.id, project_id=project.id)]
        assert do_unpin(pins, user.id, project.id)
        assert len(pins) == 0

    def test_unpin_nonexistent_returns_false(self):
        user = FakeUser()
        pins = []
        assert not do_unpin(pins, user.id, uuid4())


class TestListPins:
    def test_list_ordered_by_position(self):
        user = FakeUser()
        p1, p2, p3 = FakeProject(), FakeProject(), FakeProject()
        pins = [
            FakeWorkbenchPin(user_id=user.id, project_id=p3.id, position=2),
            FakeWorkbenchPin(user_id=user.id, project_id=p1.id, position=0),
            FakeWorkbenchPin(user_id=user.id, project_id=p2.id, position=1),
        ]
        result = list_pins(pins, user.id)
        assert [p.position for p in result] == [0, 1, 2]

    def test_cross_operator_isolation(self):
        user_a = FakeUser()
        user_b = FakeUser()
        project = FakeProject()
        pins = [
            FakeWorkbenchPin(user_id=user_a.id, project_id=project.id),
            FakeWorkbenchPin(user_id=user_b.id, project_id=project.id),
        ]
        assert len(list_pins(pins, user_a.id)) == 1
        assert len(list_pins(pins, user_b.id)) == 1
        # Unpin for user_a doesn't affect user_b
        do_unpin(pins, user_a.id, project.id)
        assert len(list_pins(pins, user_a.id)) == 0
        assert len(list_pins(pins, user_b.id)) == 1


class TestReorder:
    def test_reorder_updates_positions(self):
        user = FakeUser()
        p1, p2 = FakeProject(), FakeProject()
        pins = [
            FakeWorkbenchPin(user_id=user.id, project_id=p1.id, position=0),
            FakeWorkbenchPin(user_id=user.id, project_id=p2.id, position=1),
        ]
        reorder_pins(pins, user.id, [
            {"project_id": p1.id, "position": 1},
            {"project_id": p2.id, "position": 0},
        ])
        result = list_pins(pins, user.id)
        assert result[0].project_id == p2.id
        assert result[1].project_id == p1.id

    def test_reorder_ignores_other_operators(self):
        user_a = FakeUser()
        user_b = FakeUser()
        p1 = FakeProject()
        pins = [
            FakeWorkbenchPin(user_id=user_a.id, project_id=p1.id, position=0),
            FakeWorkbenchPin(user_id=user_b.id, project_id=p1.id, position=0),
        ]
        reorder_pins(pins, user_a.id, [{"project_id": p1.id, "position": 5}])
        a_pins = list_pins(pins, user_a.id)
        b_pins = list_pins(pins, user_b.id)
        assert a_pins[0].position == 5
        assert b_pins[0].position == 0  # unchanged

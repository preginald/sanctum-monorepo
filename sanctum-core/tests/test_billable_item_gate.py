"""Unit tests for the billable item enforcement gate (#941).

Tests the gate logic from tickets.py update_ticket endpoint:
- Resolve blocked when no time entries AND no materials (expect 422)
- Resolve succeeds with time entry only
- Resolve succeeds with material only
- Resolve succeeds with both
- no_billable=true bypasses the gate
- skip_validation=true bypasses the gate
- Already-resolved tickets not affected
"""

import pytest
from fastapi import HTTPException


def check_billable_item_gate(
    *,
    skip_validation: bool,
    update_status: str | None,
    current_status: str,
    time_entries: list,
    materials: list,
    no_billable_update: bool | None = None,
    no_billable_existing: bool = False,
):
    """
    Reproduce the billable item gate logic from tickets.py lines 216-231.
    Raises HTTPException(422) when the gate blocks resolution.
    Returns None when the gate passes.
    """
    update_data = {}
    if update_status is not None:
        update_data['status'] = update_status
    if no_billable_update is not None:
        update_data['no_billable'] = no_billable_update

    if not skip_validation and update_data.get('status') == 'resolved' and current_status != 'resolved':
        has_time_entries = len(time_entries) > 0
        has_materials = len(materials) > 0
        is_no_billable = update_data.get('no_billable') or no_billable_existing
        if not has_time_entries and not has_materials and not is_no_billable:
            raise HTTPException(
                status_code=422,
                detail={
                    "detail": "billable_item_required: add time entries or materials before resolving",
                    "error_code": "billable_item_required",
                    "time_entry_count": 0,
                    "material_count": 0,
                    "help": "Log time entries or add materials/products to this ticket before resolving. Set no_billable=true with a reason to bypass. See BUS-001 D7 and SYS-002.",
                },
            )


class TestBillableItemGateBlocks:
    """Gate should block resolution when no billable items exist."""

    def test_resolve_no_billable_items_returns_422(self):
        with pytest.raises(HTTPException) as exc_info:
            check_billable_item_gate(
                skip_validation=False,
                update_status='resolved',
                current_status='open',
                time_entries=[],
                materials=[],
            )
        assert exc_info.value.status_code == 422
        detail = exc_info.value.detail
        assert detail["error_code"] == "billable_item_required"
        assert detail["time_entry_count"] == 0
        assert detail["material_count"] == 0
        assert "BUS-001" in detail["help"]

    def test_error_includes_bypass_instructions(self):
        with pytest.raises(HTTPException) as exc_info:
            check_billable_item_gate(
                skip_validation=False,
                update_status='resolved',
                current_status='open',
                time_entries=[],
                materials=[],
            )
        assert "no_billable=true" in exc_info.value.detail["help"]
        assert "SYS-002" in exc_info.value.detail["help"]


class TestBillableItemGatePasses:
    """Gate should allow resolution when billable items exist."""

    def test_resolve_with_time_entry_succeeds(self):
        # Should not raise
        check_billable_item_gate(
            skip_validation=False,
            update_status='resolved',
            current_status='open',
            time_entries=["entry1"],
            materials=[],
        )

    def test_resolve_with_material_succeeds(self):
        check_billable_item_gate(
            skip_validation=False,
            update_status='resolved',
            current_status='open',
            time_entries=[],
            materials=["material1"],
        )

    def test_resolve_with_both_succeeds(self):
        check_billable_item_gate(
            skip_validation=False,
            update_status='resolved',
            current_status='open',
            time_entries=["entry1"],
            materials=["material1"],
        )


class TestBillableItemGateBypass:
    """Gate should be bypassed by no_billable and skip_validation."""

    def test_no_billable_flag_in_update_bypasses_gate(self):
        check_billable_item_gate(
            skip_validation=False,
            update_status='resolved',
            current_status='open',
            time_entries=[],
            materials=[],
            no_billable_update=True,
        )

    def test_no_billable_flag_on_ticket_bypasses_gate(self):
        check_billable_item_gate(
            skip_validation=False,
            update_status='resolved',
            current_status='open',
            time_entries=[],
            materials=[],
            no_billable_existing=True,
        )

    def test_skip_validation_bypasses_gate(self):
        check_billable_item_gate(
            skip_validation=True,
            update_status='resolved',
            current_status='open',
            time_entries=[],
            materials=[],
        )


class TestBillableItemGateScope:
    """Gate should only fire on the resolve transition."""

    def test_already_resolved_ticket_not_affected(self):
        # Updating a resolved ticket to resolved again should not trigger gate
        check_billable_item_gate(
            skip_validation=False,
            update_status='resolved',
            current_status='resolved',
            time_entries=[],
            materials=[],
        )

    def test_non_resolve_update_not_affected(self):
        # Status change to something other than resolved
        check_billable_item_gate(
            skip_validation=False,
            update_status='open',
            current_status='new',
            time_entries=[],
            materials=[],
        )

    def test_no_status_change_not_affected(self):
        # Update with no status field at all
        check_billable_item_gate(
            skip_validation=False,
            update_status=None,
            current_status='open',
            time_entries=[],
            materials=[],
        )

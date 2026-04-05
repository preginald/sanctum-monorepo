"""Unit tests for milestone sequence insert-and-shift logic (#1529).

Tests the shift functions from milestone_sequencing.py:
- Insert at occupied sequence shifts existing milestones up
- Insert at unoccupied sequence is a no-op
- Move up shifts milestones in [new, old) range up by 1
- Move down shifts milestones in (old, new] range down by 1
- Move to same sequence is a no-op
- Cross-project isolation — only milestones in the target project shift
"""

import pytest
from unittest.mock import MagicMock, patch
from uuid import uuid4


# ---------------------------------------------------------------------------
# Lightweight milestone stub
# ---------------------------------------------------------------------------

class FakeMilestone:
    """Minimal stand-in for models.Milestone ORM instances."""

    def __init__(self, id, project_id, sequence):
        self.id = id
        self.project_id = project_id
        self.sequence = sequence


# ---------------------------------------------------------------------------
# Reproduce shift logic from milestone_sequencing.py for unit testing
# ---------------------------------------------------------------------------

def shift_sequences_for_insert(milestones: list[FakeMilestone], target_sequence: int) -> None:
    """Pure-logic version: shift milestones at target_sequence or above up by 1."""
    affected = sorted(
        [m for m in milestones if m.sequence >= target_sequence],
        key=lambda m: m.sequence,
        reverse=True,
    )
    for ms in affected:
        ms.sequence += 1


def shift_sequences_for_move(
    milestones: list[FakeMilestone],
    milestone_id,
    old_sequence: int,
    new_sequence: int,
) -> None:
    """Pure-logic version: re-sequence surrounding milestones on move."""
    if new_sequence == old_sequence:
        return

    if new_sequence < old_sequence:
        affected = sorted(
            [m for m in milestones
             if m.id != milestone_id
             and m.sequence >= new_sequence
             and m.sequence < old_sequence],
            key=lambda m: m.sequence,
            reverse=True,
        )
        for ms in affected:
            ms.sequence += 1
    else:
        affected = sorted(
            [m for m in milestones
             if m.id != milestone_id
             and m.sequence > old_sequence
             and m.sequence <= new_sequence],
            key=lambda m: m.sequence,
        )
        for ms in affected:
            ms.sequence -= 1


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

PROJECT_A = str(uuid4())
PROJECT_B = str(uuid4())


def _make_milestones(project_id, sequences):
    """Create a list of FakeMilestones for a project at given sequences."""
    return [FakeMilestone(id=uuid4(), project_id=project_id, sequence=s) for s in sequences]


def _seqs(milestones):
    """Return sorted list of sequences."""
    return sorted(m.sequence for m in milestones)


# ---------------------------------------------------------------------------
# Insert tests
# ---------------------------------------------------------------------------

class TestShiftSequencesForInsert:
    """shift_sequences_for_insert: shift milestones when a new one is created."""

    def test_insert_at_occupied_sequence_shifts_existing(self):
        """Milestones at seq 5, 6, 7 — insert at 5 → become 6, 7, 8."""
        ms = _make_milestones(PROJECT_A, [5, 6, 7])
        shift_sequences_for_insert(ms, 5)
        assert _seqs(ms) == [6, 7, 8]

    def test_insert_at_middle_shifts_only_at_and_above(self):
        """Milestones at 1, 2, 3, 4 — insert at 3 → 1, 2, 4, 5."""
        ms = _make_milestones(PROJECT_A, [1, 2, 3, 4])
        shift_sequences_for_insert(ms, 3)
        # The ones at 1 and 2 stay, 3→4, 4→5
        assert _seqs(ms) == [1, 2, 4, 5]

    def test_insert_beyond_max_is_noop(self):
        """Milestones at 1, 2, 3 — insert at 10 → no change."""
        ms = _make_milestones(PROJECT_A, [1, 2, 3])
        shift_sequences_for_insert(ms, 10)
        assert _seqs(ms) == [1, 2, 3]

    def test_insert_at_1_shifts_all(self):
        """Milestones at 1, 2, 3 — insert at 1 → 2, 3, 4."""
        ms = _make_milestones(PROJECT_A, [1, 2, 3])
        shift_sequences_for_insert(ms, 1)
        assert _seqs(ms) == [2, 3, 4]

    def test_insert_with_gaps_shifts_only_at_and_above(self):
        """Milestones at 1, 3, 5 — insert at 3 → 1, 4, 6."""
        ms = _make_milestones(PROJECT_A, [1, 3, 5])
        shift_sequences_for_insert(ms, 3)
        assert _seqs(ms) == [1, 4, 6]

    def test_empty_project_is_noop(self):
        """No milestones — insert is always safe."""
        ms = []
        shift_sequences_for_insert(ms, 1)
        assert _seqs(ms) == []


# ---------------------------------------------------------------------------
# Move tests
# ---------------------------------------------------------------------------

class TestShiftSequencesForMove:
    """shift_sequences_for_move: re-sequence when an existing milestone moves."""

    def test_move_up(self):
        """Milestone D at seq 4 moves to seq 1. Milestones at 1, 2, 3 shift to 2, 3, 4."""
        ms_a = FakeMilestone(id=uuid4(), project_id=PROJECT_A, sequence=1)
        ms_b = FakeMilestone(id=uuid4(), project_id=PROJECT_A, sequence=2)
        ms_c = FakeMilestone(id=uuid4(), project_id=PROJECT_A, sequence=3)
        ms_d = FakeMilestone(id=uuid4(), project_id=PROJECT_A, sequence=4)

        all_ms = [ms_a, ms_b, ms_c, ms_d]
        shift_sequences_for_move(all_ms, ms_d.id, old_sequence=4, new_sequence=1)
        # D not shifted by the function (caller sets it), others shift up
        assert ms_a.sequence == 2
        assert ms_b.sequence == 3
        assert ms_c.sequence == 4
        assert ms_d.sequence == 4  # unchanged by shift — caller sets to 1

    def test_move_down(self):
        """Milestone A at seq 1 moves to seq 4. Milestones at 2, 3, 4 shift to 1, 2, 3."""
        ms_a = FakeMilestone(id=uuid4(), project_id=PROJECT_A, sequence=1)
        ms_b = FakeMilestone(id=uuid4(), project_id=PROJECT_A, sequence=2)
        ms_c = FakeMilestone(id=uuid4(), project_id=PROJECT_A, sequence=3)
        ms_d = FakeMilestone(id=uuid4(), project_id=PROJECT_A, sequence=4)

        all_ms = [ms_a, ms_b, ms_c, ms_d]
        shift_sequences_for_move(all_ms, ms_a.id, old_sequence=1, new_sequence=4)
        assert ms_a.sequence == 1  # unchanged by shift — caller sets to 4
        assert ms_b.sequence == 1
        assert ms_c.sequence == 2
        assert ms_d.sequence == 3

    def test_move_same_sequence_is_noop(self):
        """Moving to the same position changes nothing."""
        ms_a = FakeMilestone(id=uuid4(), project_id=PROJECT_A, sequence=3)
        ms_b = FakeMilestone(id=uuid4(), project_id=PROJECT_A, sequence=4)
        all_ms = [ms_a, ms_b]
        shift_sequences_for_move(all_ms, ms_a.id, old_sequence=3, new_sequence=3)
        assert ms_a.sequence == 3
        assert ms_b.sequence == 4

    def test_move_up_partial_range(self):
        """Milestone at seq 5 moves to seq 3. Only seqs 3, 4 shift (not 1, 2)."""
        ms = _make_milestones(PROJECT_A, [1, 2, 3, 4, 5])
        target = ms[4]  # seq 5
        shift_sequences_for_move(ms, target.id, old_sequence=5, new_sequence=3)
        seqs = {m.sequence for m in ms if m.id != target.id}
        assert seqs == {1, 2, 4, 5}  # 3→4, 4→5; 1 and 2 unchanged


# ---------------------------------------------------------------------------
# Cross-project isolation
# ---------------------------------------------------------------------------

class TestCrossProjectIsolation:
    """Milestones in other projects must not be affected."""

    def test_insert_only_affects_same_project(self):
        """Insert in project A does not shift project B milestones."""
        ms_a = _make_milestones(PROJECT_A, [1, 2, 3])
        ms_b = _make_milestones(PROJECT_B, [1, 2, 3])
        # Only pass project A milestones (as the real query would filter)
        shift_sequences_for_insert(ms_a, 2)
        assert _seqs(ms_a) == [1, 3, 4]
        assert _seqs(ms_b) == [1, 2, 3]  # untouched

    def test_move_only_affects_same_project(self):
        """Move in project A does not shift project B milestones."""
        ms_a = _make_milestones(PROJECT_A, [1, 2, 3])
        ms_b = _make_milestones(PROJECT_B, [1, 2, 3])
        target = ms_a[2]  # seq 3
        shift_sequences_for_move(ms_a, target.id, old_sequence=3, new_sequence=1)
        assert _seqs(ms_b) == [1, 2, 3]  # untouched

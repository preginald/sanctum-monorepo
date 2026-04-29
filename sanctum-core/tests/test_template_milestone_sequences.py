from types import SimpleNamespace

from app.routers.templates import (
    _add_template_ticket_mapping,
    _ordered_project_template_sections,
)

from uuid import uuid4


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class FakeSection:
    """Minimal stand-in for models.TemplateSection ORM instances."""
    def __init__(self, id, template_id, sequence):
        self.id = id
        self.template_id = template_id
        self.sequence = sequence


def _section(name: str, sequence: int):
    return SimpleNamespace(name=name, sequence=sequence, items=[])


# ---------------------------------------------------------------------------
# Pure-logic reproductions of _shift_section_sequences for unit testing
# ---------------------------------------------------------------------------

def shift_section_sequences(sections: list[FakeSection], target_sequence: int) -> None:
    """Pure-logic version: shift sections at target_sequence or above up by 1."""
    affected = sorted(
        [s for s in sections if s.sequence >= target_sequence],
        key=lambda s: s.sequence,
        reverse=True,
    )
    for s in affected:
        s.sequence += 1


def deduplicate_sequences(sequences: list[int]) -> list[int]:
    """Pure-logic version of the create_template dedup logic."""
    result = []
    used = set()
    for seq in sequences:
        s = seq if seq else len(result) + 1
        while s in used:
            s += 1
        used.add(s)
        result.append(s)
    return result


def test_duplicate_template_section_sequences_create_unique_milestone_sequences():
    template = SimpleNamespace(
        sections=[
            _section("Discovery", 1),
            _section("Build", 1),
            _section("Launch", 2),
        ]
    )

    sections = _ordered_project_template_sections(template, max_seq=4)

    assert [section.name for section, _items, _sequence in sections] == [
        "Discovery",
        "Build",
        "Launch",
    ]
    assert [sequence for _section, _items, sequence in sections] == [5, 6, 7]


def test_duplicate_dependency_lookup_keys_are_marked_ambiguous():
    ticket_map = {}
    ambiguous_keys = set()
    key = (1, 1)

    _add_template_ticket_mapping(ticket_map, ambiguous_keys, key, "ticket-1", object())
    _add_template_ticket_mapping(ticket_map, ambiguous_keys, key, "ticket-2", object())
    _add_template_ticket_mapping(ticket_map, ambiguous_keys, key, "ticket-3", object())

    assert key not in ticket_map
    assert ambiguous_keys == {key}


# ---------------------------------------------------------------------------
# _shift_section_sequences — template section insert-and-shift
# ---------------------------------------------------------------------------

def test_shift_section_sequences_insert_at_occupied():
    sections = [
        FakeSection(uuid4(), "t1", 1),
        FakeSection(uuid4(), "t1", 2),
        FakeSection(uuid4(), "t1", 3),
    ]
    shift_section_sequences(sections, target_sequence=2)
    assert [s.sequence for s in sections] == [1, 3, 4]


def test_shift_section_sequences_insert_at_unoccupied():
    """Inserting at an unoccupied position still shifts higher sequences up."""
    sections = [
        FakeSection(uuid4(), "t1", 1),
        FakeSection(uuid4(), "t1", 3),
    ]
    shift_section_sequences(sections, target_sequence=2)
    # Section at seq 3 is >= target_sequence, so it shifts to 4
    assert [s.sequence for s in sections] == [1, 4]


def test_shift_section_sequences_insert_at_one():
    sections = [
        FakeSection(uuid4(), "t1", 1),
        FakeSection(uuid4(), "t1", 2),
        FakeSection(uuid4(), "t1", 3),
    ]
    shift_section_sequences(sections, target_sequence=1)
    assert [s.sequence for s in sections] == [2, 3, 4]


def test_shift_section_sequences_insert_beyond_max():
    sections = [
        FakeSection(uuid4(), "t1", 1),
        FakeSection(uuid4(), "t1", 2),
    ]
    shift_section_sequences(sections, target_sequence=5)
    assert [s.sequence for s in sections] == [1, 2]


def test_shift_section_sequences_empty():
    sections = []
    shift_section_sequences(sections, target_sequence=1)
    assert sections == []


# ---------------------------------------------------------------------------
# create_template duplicate section sequence deduplication
# ---------------------------------------------------------------------------

def test_deduplicate_sequences_no_duplicates():
    assert deduplicate_sequences([1, 2, 3]) == [1, 2, 3]


def test_deduplicate_sequences_all_duplicates():
    assert deduplicate_sequences([1, 1, 1]) == [1, 2, 3]


def test_deduplicate_sequences_mixed_duplicates():
    assert deduplicate_sequences([1, 1, 2]) == [1, 2, 3]


def test_deduplicate_sequences_empty():
    assert deduplicate_sequences([]) == []


def test_deduplicate_sequences_zero_values():
    assert deduplicate_sequences([0, 0, 0]) == [1, 2, 3]


# ---------------------------------------------------------------------------
# Frontend reorder — client-side section sequence reassignment
# ---------------------------------------------------------------------------

def renumber_sections(sections: list) -> list:
    """Simulates the frontend renumbering after a reorder."""
    for idx, s in enumerate(sections):
        s.sequence = idx + 1
    return sections


def test_renumber_sections_after_reorder():
    sections = [
        FakeSection(uuid4(), "t1", 3),
        FakeSection(uuid4(), "t1", 1),
        FakeSection(uuid4(), "t1", 2),
    ]
    renumber_sections(sections)
    assert [s.sequence for s in sections] == [1, 2, 3]

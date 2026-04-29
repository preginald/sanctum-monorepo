from datetime import datetime
from types import SimpleNamespace

from app.routers.templates import (
    _add_template_ticket_mapping,
    _ordered_project_template_sections,
)


def _section(name: str, sequence: int, created_at: datetime):
    return SimpleNamespace(
        id=name,
        name=name,
        sequence=sequence,
        created_at=created_at,
        items=[],
    )


def test_duplicate_template_section_sequences_create_unique_milestone_sequences():
    template = SimpleNamespace(
        sections=[
            _section("Discovery", 1, datetime(2026, 1, 1)),
            _section("Build", 1, datetime(2026, 1, 2)),
            _section("Launch", 2, datetime(2026, 1, 3)),
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

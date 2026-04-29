from types import SimpleNamespace

from app.routers.templates import _ordered_project_template_sections


def _section(name: str, sequence: int):
    return SimpleNamespace(name=name, sequence=sequence, items=[])


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

from types import SimpleNamespace

from app.schemas.templates import TemplateCreate
from app.routers.templates import _normalize_template_sequences


def test_omitted_template_section_sequences_remain_unset():
    payload = TemplateCreate(
        name="Task",
        template_type="project",
        sections=[
            {"name": "Phase 0: The Brief"},
            {"name": "Phase 1: The Execution"},
        ],
    )

    assert [section.sequence for section in payload.sections] == [None, None]


def test_omitted_template_item_sequences_remain_unset():
    payload = TemplateCreate(
        name="Task",
        template_type="project",
        sections=[
            {
                "name": "Phase 1: The Execution",
                "items": [
                    {"subject": "First task"},
                    {"subject": "Second task"},
                ],
            }
        ],
    )

    items = payload.sections[0].items
    assert [item.sequence for item in items] == [None, None]


def test_explicit_template_sequences_are_preserved():
    payload = TemplateCreate(
        name="Task",
        template_type="project",
        sections=[
            {
                "name": "Phase 0: The Brief",
                "sequence": 10,
                "items": [{"subject": "First task", "sequence": 20}],
            }
        ],
    )

    assert payload.sections[0].sequence == 10
    assert payload.sections[0].items[0].sequence == 20


def test_template_sequence_normalization_removes_section_duplicates_and_gaps():
    template = SimpleNamespace(
        sections=[
            SimpleNamespace(id="b", created_at=None, sequence=3, items=[]),
            SimpleNamespace(id="a", created_at=None, sequence=1, items=[]),
            SimpleNamespace(id="c", created_at=None, sequence=3, items=[]),
        ]
    )

    _normalize_template_sequences(template)

    ordered_sections = sorted(template.sections, key=lambda section: section.id)
    assert [section.sequence for section in ordered_sections] == [1, 2, 3]


def test_template_sequence_normalization_removes_item_duplicates_and_gaps():
    section = SimpleNamespace(
        id="section",
        created_at=None,
        sequence=1,
        items=[
            SimpleNamespace(id="b", created_at=None, sequence=5),
            SimpleNamespace(id="a", created_at=None, sequence=1),
            SimpleNamespace(id="c", created_at=None, sequence=5),
        ],
    )
    template = SimpleNamespace(sections=[section])

    _normalize_template_sequences(template)

    ordered_items = sorted(section.items, key=lambda item: item.id)
    assert [item.sequence for item in ordered_items] == [1, 2, 3]

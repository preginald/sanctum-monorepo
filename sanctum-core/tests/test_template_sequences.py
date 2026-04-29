from app.schemas.templates import TemplateCreate


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

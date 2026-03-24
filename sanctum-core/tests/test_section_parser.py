"""Unit tests for app.services.section_parser."""

import pytest
from app.services.section_parser import (
    parse_sections,
    get_headings,
    get_section,
    replace_section,
)


SAMPLE_MD = """\
# Title

Intro paragraph.

## Background

Some background text.
More background.

## Requirements

- Item 1
- Item 2

### Sub-requirement

Details here.

## Notes

Final notes.
"""


class TestParseSections:
    def test_basic_extraction(self):
        sections = parse_sections(SAMPLE_MD)
        headings = [s.heading for s in sections]
        assert headings == [
            "# Title",
            "## Background",
            "## Requirements",
            "### Sub-requirement",
            "## Notes",
        ]

    def test_heading_levels(self):
        sections = parse_sections(SAMPLE_MD)
        levels = [s.level for s in sections]
        assert levels == [1, 2, 2, 3, 2]

    def test_body_content(self):
        sections = parse_sections(SAMPLE_MD)
        bg = next(s for s in sections if s.heading == "## Background")
        assert "Some background text." in bg.body
        assert "More background." in bg.body

    def test_empty_content(self):
        assert parse_sections("") == []
        assert parse_sections("No headings here") == []

    def test_empty_section(self):
        md = "## First\n## Second\nContent"
        sections = parse_sections(md)
        assert sections[0].body.strip() == ""
        assert "Content" in sections[1].body

    def test_line_positions(self):
        sections = parse_sections(SAMPLE_MD)
        title = sections[0]
        assert title.start_line == 0
        bg = sections[1]
        assert bg.start_line > 0


class TestCodeBlockHandling:
    def test_heading_inside_code_block_ignored(self):
        md = """\
## Real Heading

Some text.

```python
## This is not a heading
def foo():
    pass
```

## Another Real Heading

More text.
"""
        sections = parse_sections(md)
        headings = [s.heading for s in sections]
        assert "## This is not a heading" not in headings
        assert headings == ["## Real Heading", "## Another Real Heading"]

    def test_tilde_fence(self):
        md = """\
## Before

~~~
## Inside tilde fence
~~~

## After
"""
        sections = parse_sections(md)
        headings = [s.heading for s in sections]
        assert headings == ["## Before", "## After"]


class TestDuplicateHeadings:
    def test_duplicate_heading_index(self):
        md = """\
## Section

First content.

## Section

Second content.

## Section

Third content.
"""
        sections = parse_sections(md)
        assert len(sections) == 3
        assert sections[0].index == 0
        assert sections[1].index == 1
        assert sections[2].index == 2

    def test_get_section_by_index(self):
        md = "## Dup\nFirst\n## Dup\nSecond"
        s0 = get_section(md, "## Dup", index=0)
        s1 = get_section(md, "## Dup", index=1)
        assert s0 is not None
        assert "First" in s0.body
        assert s1 is not None
        assert "Second" in s1.body


class TestGetHeadings:
    def test_returns_heading_info(self):
        headings = get_headings(SAMPLE_MD)
        assert len(headings) == 5
        assert headings[0].heading == "# Title"
        assert headings[0].level == 1
        assert headings[0].index == 0


class TestGetSection:
    def test_found(self):
        s = get_section(SAMPLE_MD, "## Requirements")
        assert s is not None
        assert "- Item 1" in s.body

    def test_not_found(self):
        s = get_section(SAMPLE_MD, "## Nonexistent")
        assert s is None

    def test_sub_section(self):
        s = get_section(SAMPLE_MD, "### Sub-requirement")
        assert s is not None
        assert "Details here." in s.body


class TestReplaceSection:
    def test_basic_replace(self):
        result = replace_section(SAMPLE_MD, "## Background", "New background content.")
        assert "New background content." in result
        assert "Some background text." not in result
        # Other sections preserved
        assert "## Requirements" in result
        assert "- Item 1" in result

    def test_replace_preserves_heading(self):
        result = replace_section(SAMPLE_MD, "## Background", "Replaced.")
        assert "## Background\n" in result

    def test_replace_not_found(self):
        with pytest.raises(ValueError, match="Section not found"):
            replace_section(SAMPLE_MD, "## Missing", "content")

    def test_replace_invalid_heading(self):
        with pytest.raises(ValueError, match="Invalid heading"):
            replace_section(SAMPLE_MD, "Not a heading", "content")

    def test_replace_duplicate_by_index(self):
        md = "## Dup\nFirst\n## Dup\nSecond\n## End\nDone"
        result = replace_section(md, "## Dup", "Replaced.", index=1)
        assert "First" in result  # First occurrence untouched
        assert "Replaced." in result
        assert "Second" not in result

    def test_replace_empty_content(self):
        with pytest.raises(ValueError):
            replace_section("", "## Foo", "bar")

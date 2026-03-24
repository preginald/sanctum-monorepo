"""Reusable markdown section parser service.

Parses ATX-style headings (# through ######) into discrete sections,
supporting read-by-section, heading listing, and section replacement.
Headings inside fenced code blocks are ignored.
"""

import re
from dataclasses import dataclass


@dataclass
class Section:
    """A parsed markdown section."""
    heading: str       # Full heading text e.g. "## Background"
    level: int         # 1-6
    body: str          # Content below the heading (excluding heading line)
    start_line: int    # 0-based line index of the heading
    end_line: int      # 0-based line index of last line (exclusive)
    index: int = 0     # Disambiguation index for duplicate headings


@dataclass
class HeadingInfo:
    """Lightweight heading metadata (no body content)."""
    heading: str
    level: int
    index: int = 0


def _find_fenced_ranges(lines: list[str]) -> set[int]:
    """Return set of line indices that are inside fenced code blocks."""
    inside = set()
    in_fence = False
    fence_pattern = re.compile(r'^(`{3,}|~{3,})')
    for i, line in enumerate(lines):
        stripped = line.strip()
        if fence_pattern.match(stripped):
            if not in_fence:
                in_fence = True
                inside.add(i)
            else:
                in_fence = False
                inside.add(i)
            continue
        if in_fence:
            inside.add(i)
    return inside


_HEADING_RE = re.compile(r'^(#{1,6})\s+(.+)$')


def parse_sections(markdown: str) -> list[Section]:
    """Parse markdown into a list of sections by ATX headings.

    Headings inside fenced code blocks are ignored.
    Duplicate headings are disambiguated by index.
    """
    if not markdown:
        return []

    lines = markdown.split('\n')
    fenced = _find_fenced_ranges(lines)

    # Find all heading positions
    heading_positions: list[tuple[int, int, str]] = []  # (line_idx, level, full_heading)
    for i, line in enumerate(lines):
        if i in fenced:
            continue
        m = _HEADING_RE.match(line)
        if m:
            level = len(m.group(1))
            heading_positions.append((i, level, line))

    if not heading_positions:
        return []

    # Build sections
    sections: list[Section] = []
    heading_counts: dict[str, int] = {}

    for idx, (line_idx, level, heading) in enumerate(heading_positions):
        # Determine end: next heading line or end of document
        if idx + 1 < len(heading_positions):
            end_line = heading_positions[idx + 1][0]
        else:
            end_line = len(lines)

        # Body is everything between heading line and end
        body_lines = lines[line_idx + 1:end_line]
        body = '\n'.join(body_lines)

        # Disambiguation index for duplicate headings
        count = heading_counts.get(heading, 0)
        heading_counts[heading] = count + 1

        sections.append(Section(
            heading=heading,
            level=level,
            body=body,
            start_line=line_idx,
            end_line=end_line,
            index=count,
        ))

    return sections


def get_headings(markdown: str) -> list[HeadingInfo]:
    """Extract heading metadata without body content."""
    sections = parse_sections(markdown)
    return [
        HeadingInfo(heading=s.heading, level=s.level, index=s.index)
        for s in sections
    ]


def get_section(markdown: str, heading: str, index: int = 0) -> Section | None:
    """Get a single section by heading text.

    Args:
        markdown: The markdown content.
        heading: Exact heading string (e.g. "## Background").
        index: Disambiguation index for duplicate headings (default 0).
    """
    sections = parse_sections(markdown)
    count = 0
    for s in sections:
        if s.heading == heading:
            if count == index:
                return s
            count += 1
    return None


def replace_section(markdown: str, heading: str, new_body: str, index: int = 0) -> str:
    """Replace the body of a section, preserving document structure.

    Uses next-heading stop logic consistent with parse_sections/get_section:
    the section extends from the heading to the next heading of any level,
    or end of document. Sub-sections are preserved.

    Args:
        markdown: The full markdown content.
        heading: Exact heading string (e.g. "## Background").
        new_body: New body content (excluding heading line).
        index: Disambiguation index for duplicate headings.

    Returns:
        Updated markdown with the section body replaced.

    Raises:
        ValueError: If the heading is not found.
    """
    if not markdown:
        raise ValueError(f"Section not found: {heading}")

    lines = markdown.split('\n')
    fenced = _find_fenced_ranges(lines)

    # Find the target heading
    heading_match = re.match(r'^(#{1,6})\s', heading)
    if not heading_match:
        raise ValueError(f"Invalid heading format: {heading}")
    target_level = len(heading_match.group(1))

    # Find all occurrences of this heading
    occurrences: list[int] = []
    for i, line in enumerate(lines):
        if i in fenced:
            continue
        if line == heading:
            occurrences.append(i)

    if index >= len(occurrences):
        raise ValueError(f"Section not found: {heading}")

    start = occurrences[index]

    # Find end: next heading of ANY level (not inside code block)
    # Must match parse_sections/get_section which stop at the next heading
    # regardless of level, to avoid silently destroying sub-sections.
    end = len(lines)
    for i in range(start + 1, len(lines)):
        if i in fenced:
            continue
        m = _HEADING_RE.match(lines[i])
        if m:
            end = i
            break

    # Rebuild: heading line + new body + rest of document
    new_body_clean = new_body.strip('\n') + '\n'
    result_lines = lines[:start + 1] + [new_body_clean] + lines[end:]
    return '\n'.join(result_lines)

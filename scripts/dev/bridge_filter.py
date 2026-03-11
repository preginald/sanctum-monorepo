"""
bridge_filter.py — Terminal Bridge output filter
Part of: Terminal Bridge (DOC-023), Ticket #327

Filters terminal output to strip noise before sending to Claude:
  - Strips venv/site-packages frames from Python tracebacks
  - Strips repeated uvicorn/starlette/fastapi middleware frames
  - Retains all non-traceback content untouched
  - Retains app-level frames (anything outside venv/site-packages)
"""

import re

# Paths that indicate framework/library frames — never diagnostic
_NOISE_PATHS = (
    "venv/",
    "site-packages/",
    "uvicorn/",
    "starlette/",
    "fastapi/",
    "asyncio/",
)

# Matches a traceback frame line:
#   File "/path/to/file.py", line 42, in some_function
_FRAME_RE = re.compile(r'^\s*File "([^"]+)", line \d+')


def _is_noise_frame(line: str) -> bool:
    """Return True if this frame line points to a library/framework path."""
    match = _FRAME_RE.match(line)
    if not match:
        return False
    path = match.group(1)
    return any(noise in path for noise in _NOISE_PATHS)


def filter_traceback(text: str) -> str:
    """
    Process a block of text and strip noise frames from any Python tracebacks.

    Rules:
    - Lines that are not frame lines are always retained.
    - Frame lines pointing to venv/site-packages/uvicorn/starlette/fastapi
      are dropped.
    - Frame lines pointing to application code are retained.
    - The line immediately following a retained frame (the code snippet line)
      is also retained.

    Returns the filtered text as a string.
    """
    lines = text.splitlines(keepends=True)
    result = []
    i = 0

    while i < len(lines):
        line = lines[i]

        if _FRAME_RE.match(line):
            if _is_noise_frame(line):
                # Drop this frame line and its following code snippet line
                i += 1  # skip frame
                if (
                    i < len(lines)
                    and not _FRAME_RE.match(lines[i])
                    and lines[i].strip()
                ):
                    i += 1  # skip code snippet
            else:
                # Retain app-level frame and its code snippet
                result.append(line)
                i += 1
                if (
                    i < len(lines)
                    and not _FRAME_RE.match(lines[i])
                    and lines[i].strip()
                ):
                    result.append(lines[i])
                    i += 1
        else:
            result.append(line)
            i += 1

    return "".join(result)


def filter_output(text: str) -> str:
    """
    Top-level filter. Apply all filtering passes to raw terminal output.

    Currently applies:
    1. Traceback frame filtering (venv/library frame stripping)

    Phase 2 will add:
    - Log line deduplication
    - uvicorn access log compression
    - configurable allowlist paths
    """
    text = filter_traceback(text)
    return text

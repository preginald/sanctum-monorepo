#!/usr/bin/env python3
"""
bridge_cache.py — Terminal Bridge local article cache
Part of: Terminal Bridge (DOC-023), Ticket #325

Prevents redundant full-content resubmission of KB articles by caching
fetched content and diffing before update.

── Python module usage (Phase 2 / bridge.py) ────────────────────────────────
    from bridge_cache import ArticleCache
    cache = ArticleCache()
    cache.set("DOC-023", content)
    if cache.diff("DOC-023", new_content):
        # content changed — proceed with update
        submit_update(new_content)
        cache.invalidate("DOC-023")

── CLI usage (sanctum.sh integration) ───────────────────────────────────────
    # Store fetched content
    python3 scripts/dev/bridge_cache.py set DOC-023 /tmp/content.md

    # Check if content has changed before submitting
    python3 scripts/dev/bridge_cache.py diff DOC-023 /tmp/new_content.md
    # exit 0 = changed (proceed), exit 1 = identical (skip)

    # Invalidate after successful update
    python3 scripts/dev/bridge_cache.py invalidate DOC-023

── Cache location ────────────────────────────────────────────────────────────
    ~/.sanctum/article_cache/{IDENTIFIER}.txt
    e.g. ~/.sanctum/article_cache/DOC-023.txt

── Exit codes (CLI) ─────────────────────────────────────────────────────────
    diff: 0 = content changed, 1 = identical, 2 = no cached version (treat as changed)
    set:  0 = success
    invalidate: 0 = success (even if no cache entry existed)
"""

import os
import sys

# ─────────────────────────────────────────────
# Cache directory
# ─────────────────────────────────────────────

CACHE_DIR = os.path.join(os.path.expanduser("~"), ".sanctum", "article_cache")


# ─────────────────────────────────────────────
# ArticleCache — importable module interface
# ─────────────────────────────────────────────


class ArticleCache:
    """
    File-based article content cache keyed by identifier (e.g. DOC-023).
    Cache persists across invocations in ~/.sanctum/article_cache/.
    """

    def __init__(self, cache_dir: str = CACHE_DIR):
        self.cache_dir = cache_dir
        os.makedirs(self.cache_dir, exist_ok=True)

    def _path(self, identifier: str) -> str:
        """Return the cache file path for a given identifier."""
        # Sanitise identifier to safe filename
        safe = identifier.replace("/", "_").replace(" ", "_")
        return os.path.join(self.cache_dir, f"{safe}.txt")

    def get(self, identifier: str) -> str | None:
        """
        Return cached content for identifier, or None if not cached.
        """
        path = self._path(identifier)
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            return f.read()

    def set(self, identifier: str, content: str) -> None:
        """
        Store content in cache for identifier.
        Overwrites any existing cached version.
        """
        path = self._path(identifier)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

    def invalidate(self, identifier: str) -> None:
        """
        Remove cached content for identifier.
        No-op if no cache entry exists.
        """
        path = self._path(identifier)
        if os.path.exists(path):
            os.remove(path)

    def diff(self, identifier: str, new_content: str) -> bool:
        """
        Compare new_content against cached content for identifier.

        Returns:
            True  — content has changed (or no cache entry exists)
            False — content is identical to cached version
        """
        cached = self.get(identifier)
        if cached is None:
            return True  # no cache — treat as changed
        return cached.strip() != new_content.strip()


# ─────────────────────────────────────────────
# CLI interface — for sanctum.sh integration
# ─────────────────────────────────────────────

CYAN = "\033[0;36m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
RED = "\033[0;31m"
GRAY = "\033[0;90m"
NC = "\033[0m"


def _read_file(path: str) -> str:
    if not os.path.exists(path):
        print(f"{RED}✗ File not found: {path}{NC}", file=sys.stderr)
        sys.exit(2)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def cmd_set(identifier: str, file_path: str) -> None:
    """Cache the content of file_path under identifier."""
    content = _read_file(file_path)
    cache = ArticleCache()
    cache.set(identifier, content)
    size = len(content)
    print(
        f"{GREEN}✓ Cached {identifier}{NC} {GRAY}({size} chars → {cache._path(identifier)}){NC}"
    )
    sys.exit(0)


def cmd_diff(identifier: str, file_path: str) -> None:
    """
    Diff file_path content against cached version of identifier.
    Exit 0 = changed (proceed), Exit 1 = identical (skip), Exit 2 = no cache (treat as changed).
    """
    new_content = _read_file(file_path)
    cache = ArticleCache()
    cached = cache.get(identifier)

    if cached is None:
        print(f"{YELLOW}⚠ No cache entry for {identifier} — treating as changed{NC}")
        sys.exit(2)

    if cached.strip() == new_content.strip():
        print(f"{GRAY}↔ {identifier}: no changes detected — skipping update{NC}")
        sys.exit(1)
    else:
        print(f"{CYAN}↕ {identifier}: content changed — proceeding with update{NC}")
        sys.exit(0)


def cmd_invalidate(identifier: str) -> None:
    """Remove cached content for identifier."""
    cache = ArticleCache()
    path = cache._path(identifier)
    if os.path.exists(path):
        cache.invalidate(identifier)
        print(f"{GREEN}✓ Cache invalidated: {identifier}{NC}")
    else:
        print(f"{GRAY}↔ No cache entry for {identifier} — nothing to invalidate{NC}")
    sys.exit(0)


def usage() -> None:
    print("Usage:")
    print("  python3 bridge_cache.py set <IDENTIFIER> <file>")
    print("  python3 bridge_cache.py diff <IDENTIFIER> <file>")
    print("  python3 bridge_cache.py invalidate <IDENTIFIER>")
    print("")
    print("Exit codes (diff):")
    print("  0 = content changed   → proceed with update")
    print("  1 = identical         → skip update")
    print("  2 = no cache entry    → treat as changed")
    sys.exit(1)


def main():
    args = sys.argv[1:]

    if not args:
        usage()

    command = args[0]

    if command == "set":
        if len(args) != 3:
            print(f"{RED}✗ set requires: <IDENTIFIER> <file>{NC}", file=sys.stderr)
            usage()
        cmd_set(args[1], args[2])

    elif command == "diff":
        if len(args) != 3:
            print(f"{RED}✗ diff requires: <IDENTIFIER> <file>{NC}", file=sys.stderr)
            usage()
        cmd_diff(args[1], args[2])

    elif command == "invalidate":
        if len(args) != 2:
            print(f"{RED}✗ invalidate requires: <IDENTIFIER>{NC}", file=sys.stderr)
            usage()
        cmd_invalidate(args[1])

    else:
        print(f"{RED}✗ Unknown command: {command}{NC}", file=sys.stderr)
        usage()


if __name__ == "__main__":
    main()

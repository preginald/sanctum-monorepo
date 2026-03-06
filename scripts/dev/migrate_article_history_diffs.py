#!/usr/bin/env python3
"""
migrate_article_history_diffs.py — Backfill article history rows with section-level diffs.

Reads existing article_history rows where diff_before IS NULL (unmigrated),
compares consecutive snapshots per article to derive section-level diffs,
and updates each row with section_heading, diff_before, diff_after.

Usage:
    python3 scripts/dev/migrate_article_history_diffs.py --dry-run
    python3 scripts/dev/migrate_article_history_diffs.py --env prod
    python3 scripts/dev/migrate_article_history_diffs.py --article DOC-009 --dry-run --env prod

Flags:
    --dry-run           Print proposed changes without writing to DB
    --env dev|prod      Target environment (default: dev)
    --article <id>      Scope to a single article by identifier or UUID
"""

import sys
import os
import re
import argparse

# Allow importing from sanctum-core
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'sanctum-core'))

from dotenv import load_dotenv

# Load correct .env based on env flag early
def load_env(env):
    base = os.path.join(os.path.dirname(__file__), '..', '..', 'sanctum-core')
    env_file = '.env.prod' if env == 'prod' else '.env'
    path = os.path.join(base, env_file)
    if os.path.exists(path):
        load_dotenv(path, override=True)
        print(f"  Loaded: {path}")
    else:
        load_dotenv(override=True)
        print(f"  Warning: {path} not found, using default .env")

def parse_sections(content):
    """
    Parse article content into a dict of {heading: body}.
    Headings are lines starting with one or more # characters.
    Content before the first heading is stored under key '__preamble__'.
    """
    sections = {}
    current_heading = '__preamble__'
    current_body = []

    for line in content.splitlines(keepends=True):
        if re.match(r'^#{1,6}\s', line):
            sections[current_heading] = ''.join(current_body)
            current_heading = line.rstrip('\n')
            current_body = []
        else:
            current_body.append(line)

    sections[current_heading] = ''.join(current_body)
    return sections

def compute_diffs(old_content, new_content):
    """
    Compare two content blobs section by section.
    Returns list of (section_heading, diff_before, diff_after) tuples.
    section_heading=None means whole-article change (no section structure).
    """
    old_sections = parse_sections(old_content or '')
    new_sections = parse_sections(new_content or '')

    all_headings = set(old_sections.keys()) | set(new_sections.keys())
    # Remove preamble-only articles — treat as whole-article change
    real_headings = [h for h in all_headings if h != '__preamble__']

    if not real_headings:
        # No section structure — whole-article diff
        if old_content != new_content:
            return [(None, old_content or '', new_content or '')]
        return []

    diffs = []
    for heading in sorted(real_headings):
        old_body = old_sections.get(heading, '')
        new_body = new_sections.get(heading, '')
        if old_body != new_body:
            diffs.append((heading, old_body, new_body))

    # If no section-level diffs found but content differs, fall back to whole-article
    if not diffs and old_content != new_content:
        return [(None, old_content or '', new_content or '')]

    return diffs

def main():
    parser = argparse.ArgumentParser(description='Backfill article history diffs')
    parser.add_argument('--dry-run', action='store_true', help='Print changes without writing')
    parser.add_argument('--env', default='dev', choices=['dev', 'prod'], help='Target environment')
    parser.add_argument('--article', default=None, help='Scope to a single article (identifier or UUID)')
    args = parser.parse_args()

    load_env(args.env)

    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker
    DATABASE_URL = os.getenv('DATABASE_URL')
    if not DATABASE_URL:
        print('  ✗ DATABASE_URL not set')
        sys.exit(1)

    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    db = Session()

    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}Article History Diff Migration")
    print(f"  Environment: {args.env}")
    print(f"  Database:    {DATABASE_URL.split('@')[-1]}\n")

    # Resolve article filter
    article_id_filter = None
    if args.article:
        if re.match(r'^[0-9a-f-]{36}$', args.article):
            article_id_filter = args.article
        else:
            row = db.execute(
                text("SELECT id FROM articles WHERE identifier = :id"),
                {'id': args.article}
            ).fetchone()
            if not row:
                print(f"  ✗ Article not found: {args.article}")
                sys.exit(1)
            article_id_filter = str(row[0])
            print(f"  Resolved {args.article} → {article_id_filter}")

    # Fetch all unmigrated history rows
    query = """
        SELECT h.id, h.article_id, h.content, h.version, h.snapshot_at,
               a.identifier, a.title
        FROM article_history h
        JOIN articles a ON a.id = h.article_id
        WHERE h.diff_before IS NULL
    """
    params = {}
    if article_id_filter:
        query += " AND h.article_id = :article_id"
        params['article_id'] = article_id_filter
    query += " ORDER BY h.article_id, h.snapshot_at ASC"

    rows = db.execute(text(query), params).fetchall()
    print(f"  Unmigrated rows: {len(rows)}")

    if not rows:
        print("  Nothing to migrate.")
        db.close()
        return

    # Group by article_id
    from collections import defaultdict
    by_article = defaultdict(list)
    for row in rows:
        by_article[row.article_id].append(row)

    total_updates = 0
    total_skipped = 0

    for article_id, snapshots in by_article.items():
        identifier = snapshots[0].identifier
        title = snapshots[0].title
        print(f"\n  Article: {identifier} — {title} ({len(snapshots)} snapshots)")

        for i, snap in enumerate(snapshots):
            if i == 0:
                # First snapshot — initial creation, no previous content
                diffs = [(None, '', snap.content or '')]
            else:
                prev = snapshots[i - 1]
                diffs = compute_diffs(prev.content, snap.content)

            if not diffs:
                print(f"    {snap.version} — no changes detected, skipping")
                total_skipped += 1
                continue

            for section_heading, diff_before, diff_after in diffs:
                label = section_heading if section_heading else '(whole article)'
                before_preview = (diff_before or '')[:60].replace('\n', '↵')
                after_preview = (diff_after or '')[:60].replace('\n', '↵')
                print(f"    {snap.version} [{label}]")
                print(f"      before: {before_preview}")
                print(f"      after:  {after_preview}")

                if not args.dry_run:
                    # For the first diff of a snapshot, update the existing row
                    # For additional diffs (multi-section changes), insert new rows
                    if diffs.index((section_heading, diff_before, diff_after)) == 0:
                        db.execute(text("""
                            UPDATE article_history
                            SET section_heading = :sh,
                                diff_before = :db,
                                diff_after = :da
                            WHERE id = :id
                        """), {
                            'sh': section_heading,
                            'db': diff_before,
                            'da': diff_after,
                            'id': str(snap.id)
                        })
                    else:
                        db.execute(text("""
                            INSERT INTO article_history
                                (article_id, author_id, title, content, version, snapshot_at, section_heading, diff_before, diff_after)
                            SELECT article_id, author_id, title, content, version, snapshot_at, :sh, :db, :da
                            FROM article_history WHERE id = :id
                        """), {
                            'sh': section_heading,
                            'db': diff_before,
                            'da': diff_after,
                            'id': str(snap.id)
                        })
                total_updates += 1

    if not args.dry_run:
        db.commit()
        print(f"\n  ✓ Migration complete — {total_updates} rows updated, {total_skipped} skipped")
    else:
        print(f"\n  [DRY RUN] Would update {total_updates} rows, skip {total_skipped}")

    db.close()

if __name__ == '__main__':
    main()

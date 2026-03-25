#!/usr/bin/env python3
"""
Backfill time entries on resolved internal-project tickets with zero recorded hours.

Queries the Sanctum Core REST API directly, identifies resolved tickets with
no_billable=true and time_entry_count=0 across 9 internal projects, estimates
effort using a type-based heuristic with comment-count adjustment, and creates
backfill time entries.

Usage:
    # Dry run (default) -- prints what would be created
    python scripts/backfill_time_entries.py

    # Actually create time entries
    python scripts/backfill_time_entries.py --commit

Environment:
    SANCTUM_API_URL  Base URL of the API (default: http://localhost:8000)
    SANCTUM_TOKEN    Bearer token for API authentication (required)
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError


# --- Configuration ---

TARGET_PROJECTS = {
    "335650e8-1a85-4263-9a25-4cf2ca55fb79": "Sanctum Core v1.x",
    "5681960f-deb9-4b76-bacf-559a879bf45e": "Sanctum CMS Manager",
    "b4ec043f-6e8d-4a7b-ac6f-e1170c572c09": "Digital Sanctum Website",
    "c80a83d9-019c-473f-ba04-b522f5103786": "Sanctum Monitor",
    "f54e2148-cafd-4312-9dac-c726fc14ec84": "Sanctum Image",
    "f156b86f-8e49-4da6-a0c2-b715b640ae5d": "Sanctum Vault",
    "36222d93-80ca-4702-ade0-10d3245160a2": "Sanctum Auth",
    "d1894422-de72-4f46-af84-eabb9c7b7f79": "Digital Sanctum IT Operations",
    "0b45ba93-4710-4e11-b784-d46463200e1b": "Sanctum Audit",
}

# Base estimates by ticket type (minutes)
BASE_ESTIMATES = {
    "bug": 45,
    "feature": 90,
    "refactor": 60,
    "task": 30,
    # Lightweight types
    "hotfix": 15,
    "alert": 15,
    "support": 15,
    "access": 15,
    "maintenance": 15,
    "test": 15,
}

# Agent author substrings to filter from comment count
AGENT_KEYWORDS = [
    "Oracle",
    "Architect",
    "Sentinel",
    "Scribe",
    "Surgeon",
    "Reviewer",
    "QA",
]

FLOOR_MINUTES = 15
CEILING_MINUTES = 180  # 3 hours

AEDT = timezone(timedelta(hours=11))


# --- API helpers ---


def api_request(base_url, token, method, path, body=None):
    """Make an authenticated API request using stdlib urllib."""
    url = f"{base_url}/api{path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    data = json.dumps(body).encode("utf-8") if body else None
    req = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")
        print(f"  API error {e.code} on {method} {path}: {error_body}", file=sys.stderr)
        raise


def fetch_all_tickets(base_url, token):
    """Fetch all tickets from GET /api/tickets."""
    print("Fetching all tickets from API...")
    tickets = api_request(base_url, token, "GET", "/tickets")
    print(f"  Received {len(tickets)} tickets total.")
    return tickets


def fetch_ticket(base_url, token, ticket_id):
    """Fetch a single ticket for idempotency re-check."""
    return api_request(base_url, token, "GET", f"/tickets/{ticket_id}")


def create_time_entry(base_url, token, ticket_id, start_time, end_time, description):
    """POST a time entry on a ticket."""
    body = {
        "start_time": start_time,
        "end_time": end_time,
        "description": description,
    }
    return api_request(
        base_url, token, "POST", f"/tickets/{ticket_id}/time-entries", body
    )


# --- Estimation logic ---


def is_agent_comment(author_name):
    """Return True if the comment author is an agent (not human)."""
    for keyword in AGENT_KEYWORDS:
        if keyword in author_name:
            return True
    return False


def count_human_comments(comments):
    """Count comments excluding agent-authored ones."""
    return sum(1 for c in comments if not is_agent_comment(c.get("author_name", "")))


def estimate_minutes(ticket_type, human_comment_count):
    """Estimate effort in minutes based on ticket type and human comment count."""
    base = BASE_ESTIMATES.get(ticket_type, 30)  # default to task if unknown type

    # +15 min per 2 comments beyond the first, capped at +60
    extra_comments = max(0, human_comment_count - 1)
    comment_adjustment = min((extra_comments // 2) * 15, 60)

    total = base + comment_adjustment
    total = max(total, FLOOR_MINUTES)

    return total


# --- Filtering ---


def filter_backfill_candidates(tickets):
    """Filter tickets to those needing backfill."""
    candidates = []
    for t in tickets:
        if t.get("status") != "resolved":
            continue
        if not t.get("no_billable"):
            continue
        if t.get("time_entry_count", 0) != 0:
            continue
        project_id = t.get("project_id")
        if project_id not in TARGET_PROJECTS:
            continue
        candidates.append(t)
    return candidates


# --- Main ---


def main():
    parser = argparse.ArgumentParser(
        description="Backfill time entries on resolved internal-project tickets."
    )
    parser.add_argument(
        "--commit",
        action="store_true",
        help="Actually create time entries. Without this flag, runs in dry-run mode.",
    )
    args = parser.parse_args()

    base_url = os.environ.get("SANCTUM_API_URL", "http://localhost:8000").rstrip("/")
    token = os.environ.get("SANCTUM_TOKEN")
    if not token:
        print("Error: SANCTUM_TOKEN environment variable is required.", file=sys.stderr)
        sys.exit(1)

    is_commit = args.commit
    mode_label = "COMMIT" if is_commit else "DRY RUN"
    print(f"=== Backfill Time Entries [{mode_label}] ===\n")

    # Fetch all tickets in one call
    all_tickets = fetch_all_tickets(base_url, token)
    candidates = filter_backfill_candidates(all_tickets)
    print(f"  Found {len(candidates)} candidates for backfill.\n")

    if not candidates:
        print("Nothing to backfill.")
        return

    # Group by project for reporting
    by_project = {}
    flagged = []  # tickets exceeding ceiling

    for t in candidates:
        project_id = t["project_id"]
        project_name = TARGET_PROJECTS.get(project_id, project_id)

        comments = t.get("comments", [])
        human_comments = count_human_comments(comments)
        ticket_type = t.get("ticket_type", "task")
        minutes = estimate_minutes(ticket_type, human_comments)

        if minutes > CEILING_MINUTES:
            flagged.append(
                {
                    "id": t["id"],
                    "subject": t.get("subject", ""),
                    "project": project_name,
                    "ticket_type": ticket_type,
                    "human_comments": human_comments,
                    "estimated_minutes": minutes,
                }
            )
            # Cap at ceiling for backfill; flag for manual review
            minutes = CEILING_MINUTES

        # Build time entry timestamps
        # start_time: ticket created_at
        created_at_str = t.get("created_at", "")
        try:
            # Parse ISO 8601 -- handle both Z suffix and +00:00
            created_at_str = created_at_str.replace("Z", "+00:00")
            created_at = datetime.fromisoformat(created_at_str)
        except (ValueError, AttributeError):
            print(
                f"  Warning: cannot parse created_at for ticket #{t['id']}, skipping.",
                file=sys.stderr,
            )
            continue

        start_time = created_at
        end_time = start_time + timedelta(minutes=minutes)
        description = f"Backfill -- estimated from delivery history [{ticket_type}, {human_comments} comments]"

        entry = {
            "ticket_id": t["id"],
            "subject": t.get("subject", ""),
            "project_id": project_id,
            "project_name": project_name,
            "ticket_type": ticket_type,
            "human_comments": human_comments,
            "estimated_minutes": minutes,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "description": description,
        }

        by_project.setdefault(project_id, []).append(entry)

    # Print per-project summary
    total_tickets = 0
    total_hours = 0.0
    created_count = 0
    failed_count = 0

    for project_id, entries in sorted(
        by_project.items(), key=lambda x: x[1][0]["project_name"]
    ):
        project_name = entries[0]["project_name"]
        project_minutes = sum(e["estimated_minutes"] for e in entries)
        project_hours = project_minutes / 60.0
        total_tickets += len(entries)
        total_hours += project_hours

        print(f"--- {project_name} ---")
        print(f"  Tickets: {len(entries)}, Estimated hours: {project_hours:.1f}")

        for e in sorted(entries, key=lambda x: x["ticket_id"]):
            print(
                f"    #{e['ticket_id']:>5}  {e['ticket_type']:<12}  {e['estimated_minutes']:>3}min  {e['human_comments']} comments  {e['subject'][:60]}"
            )

            if is_commit:
                # Idempotency check: re-fetch ticket to confirm time_entry_count is still 0
                try:
                    fresh = fetch_ticket(base_url, token, e["ticket_id"])
                    if fresh.get("time_entry_count", 0) > 0:
                        print(
                            f"      SKIP -- ticket already has time entries (idempotency guard)"
                        )
                        continue
                except Exception as ex:
                    print(
                        f"      SKIP -- failed to re-check ticket: {ex}",
                        file=sys.stderr,
                    )
                    failed_count += 1
                    continue

                # Create the time entry
                try:
                    create_time_entry(
                        base_url,
                        token,
                        e["ticket_id"],
                        e["start_time"],
                        e["end_time"],
                        e["description"],
                    )
                    created_count += 1
                    print(f"      CREATED")
                except Exception as ex:
                    failed_count += 1
                    print(f"      FAILED: {ex}", file=sys.stderr)

        print()

    # Summary
    print(f"=== Summary [{mode_label}] ===")
    print(f"  Total tickets:  {total_tickets}")
    print(f"  Total hours:    {total_hours:.1f}")
    if is_commit:
        print(f"  Created:        {created_count}")
        print(f"  Failed:         {failed_count}")

    if flagged:
        print(f"\n=== Flagged for Manual Review ({len(flagged)} tickets) ===")
        print(
            "  These tickets exceeded the {0}-minute ceiling and were capped:".format(
                CEILING_MINUTES
            )
        )
        for f in flagged:
            print(
                f"    #{f['id']:>5}  {f['ticket_type']:<12}  {f['estimated_minutes']:>3}min  {f['project']}"
            )

    print("\nDone.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
import urllib.request
import json
import os
import sys
import re

API_BASE = os.environ.get("API_BASE", "https://core.digitalsanctum.com.au/api")
TOKEN = os.environ.get("SANCTUM_API_TOKEN")

if not TOKEN:
    print("Error: SANCTUM_API_TOKEN environment variable is not set.")
    sys.exit(1)

headers = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


def api_get(path):
    req = urllib.request.Request(f"{API_BASE}{path}", headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code} on {path}: {e.read().decode()}")
        sys.exit(1)


def api_put(path, data):
    req = urllib.request.Request(f"{API_BASE}{path}", headers=headers, method="PUT")
    try:
        with urllib.request.urlopen(req, data=json.dumps(data).encode()) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code} on {path}: {e.read().decode()}")
        sys.exit(1)


def get_sort_key(m):
    name = m.get("name", "")
    match = re.search(r"Phase\s+(\d+(?:\.\d+)?)", name, re.IGNORECASE)
    if match:
        phase_num = float(match.group(1))
    else:
        match_range = re.search(r"Phases\s+(\d+)", name, re.IGNORECASE)
        if match_range:
            phase_num = float(match_range.group(1))
        else:
            phase_num = 9999.0

    return (phase_num, m.get("sequence", 1), m.get("created_at", ""))


def extract_context(t):
    desc = t.get("description") or ""
    res = t.get("resolution") or ""

    ctx = ""
    # Look for ## Objective or ## Bug
    match = re.search(
        r"##\s*(Objective|Bug)\s*\n+(.*?)(?=\n##|\Z)", desc, re.IGNORECASE | re.DOTALL
    )
    if match:
        # Get first non-empty line
        lines = [l.strip() for l in match.group(2).split("\n") if l.strip()]
        if lines:
            ctx = lines[0]
    elif res:
        lines = [l.strip() for l in res.split("\n") if l.strip()]
        if lines:
            ctx = lines[0]
    elif desc:
        # Fallback to first regular text line
        lines = [
            l.strip()
            for l in desc.split("\n")
            if l.strip() and not l.strip().startswith("#")
        ]
        if lines:
            ctx = lines[0]

    if ctx:
        # Clean markdown bold/italic
        ctx = re.sub(r"[*_]{1,2}", "", ctx)
        if len(ctx) > 100:
            ctx = ctx[:97] + "..."
        if not ctx.endswith("."):
            ctx += "."
        return ctx
    return ""


def main():
    apply_mode = "--apply" in sys.argv
    print(f"=== Milestone Backfill & Sequence Fix (Apply Mode: {apply_mode}) ===")

    print("Fetching tickets...")
    tickets = api_get("/tickets")
    tickets_by_milestone = {}
    for t in tickets:
        mid = t.get("milestone_id")
        if mid:
            if mid not in tickets_by_milestone:
                tickets_by_milestone[mid] = []
            tickets_by_milestone[mid].append(t)

    print("Fetching projects...")
    projects = api_get("/projects")

    total_updated = 0

    for proj in projects:
        pid = proj["id"]
        pdetail = api_get(f"/projects/{pid}")
        milestones = pdetail.get("milestones", [])

        if not milestones:
            continue

        print(f"\nProject: {proj['name']} ({len(milestones)} milestones)")
        milestones.sort(key=get_sort_key)

        for idx, m in enumerate(milestones):
            mid = m["id"]
            current_seq = m.get("sequence") or 1
            new_seq = idx + 1

            current_desc = m.get("description")
            new_desc = current_desc

            if not current_desc:
                mtickets = tickets_by_milestone.get(mid, [])
                contexts = []
                for t in mtickets:
                    ctx = extract_context(t)
                    if ctx and ctx not in contexts:
                        contexts.append(ctx)
                    if len(contexts) >= 2:
                        break

                if contexts:
                    new_desc = " ".join(contexts)
                    if len(mtickets) > 2:
                        new_desc += f" (Plus {len(mtickets)-2} other tickets.)"
                elif mtickets:
                    subjects = [t["subject"] for t in mtickets[:2]]
                    new_desc = f"Includes: {', '.join(subjects)}."
                    if len(mtickets) > 2:
                        new_desc += f" (Plus {len(mtickets)-2} other tickets.)"
                else:
                    new_desc = f"Tracking and deliverables for {m['name']}."

            needs_update = (current_seq != new_seq) or (current_desc != new_desc)

            if needs_update:
                print(f"  [{new_seq:02d}] {m['name']}")
                if current_seq != new_seq:
                    print(f"      Sequence: {current_seq} -> {new_seq}")
                if current_desc != new_desc:
                    print(f"      Description: '{new_desc}'")

                if apply_mode:
                    api_put(
                        f"/milestones/{mid}",
                        {"sequence": new_seq, "description": new_desc},
                    )
                    total_updated += 1

    if not apply_mode:
        print(
            "\nDry run complete. Review descriptions. Run with --apply to execute changes."
        )
    else:
        print(f"\nSuccessfully updated {total_updated} milestones.")


if __name__ == "__main__":
    main()

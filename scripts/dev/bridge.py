#!/usr/bin/env python3
"""
bridge.py — Terminal Bridge relay runner
Part of: Terminal Bridge (DOC-023), Ticket #327

Usage:
    # Direct invocation — run a command and filter its output
    python3 scripts/dev/bridge.py "alembic upgrade head"
    python3 scripts/dev/bridge.py --quiet "pytest tests/"

    # Pipe mode — filter output from a command already run
    cat some_output.log | python3 scripts/dev/bridge.py
    ./scripts/dev/sanctum.sh ticket show 327 -e prod | python3 scripts/dev/bridge.py

Flags:
    --quiet / -q    Suppress the header line (command + exit code)

Exit code mirrors the subprocess exit code in direct invocation mode.
In pipe mode, exits 0 on success.
"""

import os
import sys
import subprocess

# bridge_filter.py must live alongside bridge.py
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bridge_filter import filter_output

# ─────────────────────────────────────────────
# Argument parsing (stdlib only — no argparse)
# ─────────────────────────────────────────────

def parse_args(argv):
    """
    Returns (quiet: bool, command: str | None)
    command is None in pipe mode.
    """
    args = argv[1:]
    quiet = False
    command = None

    filtered = []
    for arg in args:
        if arg in ("--quiet", "-q"):
            quiet = True
        else:
            filtered.append(arg)

    if filtered:
        # Join all remaining args as the command string
        command = " ".join(filtered)

    return quiet, command


# ─────────────────────────────────────────────
# Output helpers
# ─────────────────────────────────────────────

CYAN  = "\033[0;36m"
GRAY  = "\033[0;90m"
GREEN = "\033[0;32m"
RED   = "\033[0;31m"
NC    = "\033[0m"

def print_header(command, exit_code, quiet):
    if quiet:
        return
    exit_colour = GREEN if exit_code == 0 else RED
    print(f"{CYAN}▶ {command}{NC}  {exit_colour}[exit {exit_code}]{NC}")
    print()


# ─────────────────────────────────────────────
# Modes
# ─────────────────────────────────────────────

def run_command(command, quiet):
    """Execute command in a subprocess, filter output, print result."""
    try:
        proc = subprocess.run(
            command,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,  # merge stderr into stdout
            text=True,
        )
    except Exception as e:
        print(f"{RED}✗ bridge.py: failed to execute command: {e}{NC}", file=sys.stderr)
        sys.exit(1)

    filtered = filter_output(proc.stdout)
    print_header(command, proc.returncode, quiet)
    print(filtered, end="" if filtered.endswith("\n") else "\n")
    sys.exit(proc.returncode)


def run_pipe(quiet):
    """Read stdin, filter it, print result. Exit 0."""
    raw = sys.stdin.read()
    filtered = filter_output(raw)
    # No meaningful exit code or command name in pipe mode
    if not quiet:
        print(f"{GRAY}▶ (pipe mode){NC}")
        print()
    print(filtered, end="" if filtered.endswith("\n") else "\n")
    sys.exit(0)


# ─────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────

def main():
    quiet, command = parse_args(sys.argv)

    if command:
        run_command(command, quiet)
    elif not sys.stdin.isatty():
        run_pipe(quiet)
    else:
        print("Usage:")
        print('  python3 bridge.py "command to run"')
        print("  some_command | python3 bridge.py")
        print("  python3 bridge.py --quiet \"command\"")
        sys.exit(1)


if __name__ == "__main__":
    main()

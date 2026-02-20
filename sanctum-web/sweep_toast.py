#!/usr/bin/env python3
"""
Sweep patch: Replace showToast with addToast in TemplateLibrary.jsx and TemplateDetail.jsx
Run from: ~/Dev/DigitalSanctum/sanctum-web/
"""

import re
import sys

FILES = [
    "src/pages/TemplateLibrary.jsx",
    "src/pages/TemplateDetail.jsx",
]

total_fixed = 0

for path in FILES:
    with open(path, 'r') as f:
        content = f.read()

    original = content

    # Fix 1: destructuring — { showToast } -> { addToast }
    content = content.replace(
        "const { showToast } = useToast();",
        "const { addToast } = useToast();"
    )

    # Fix 2: all call sites — showToast( -> addToast(
    content = content.replace("showToast(", "addToast(")

    count = original.count("showToast")
    total_fixed += count

    if content != original:
        with open(path, 'w') as f:
            f.write(content)
        print(f"✓ {path} — {count} occurrences replaced")
    else:
        print(f"✗ {path} — no changes made (check manually)")

print(f"\n✓ Total replaced: {total_fixed}")

# Verification — should return zero
print("\n--- Verification (should be empty) ---")
import subprocess
for path in FILES:
    result = subprocess.run(["grep", "-n", "showToast", path], capture_output=True, text=True)
    if result.stdout:
        print(f"✗ Remaining in {path}:\n{result.stdout}")
    else:
        print(f"✓ {path} — clean")

#!/usr/bin/env python3
"""
Seed: Website Audit (SOP-104)
Creates the Website Audit project template in the Template Library.

Run from: ~/Dev/DigitalSanctum/sanctum-core/
Usage:    python -m seeders.seed_website_audit_template
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app import models

db = SessionLocal()

TEMPLATE_NAME = "Website Audit"

# Guard: don't seed twice
existing = db.query(models.Template).filter(
    models.Template.name == TEMPLATE_NAME
).first()

if existing:
    print(f"Template already exists: '{TEMPLATE_NAME}' ({existing.id})")
    print("  Delete it first if you want to re-seed.")
    db.close()
    sys.exit(0)


# ---------------------------------------------------------------------------
# TEMPLATE DEFINITION (derived from SOP-104 section 6.4)
# ---------------------------------------------------------------------------

SECTIONS = [
    {
        "name": "Conduct Audit",
        "sequence": 1,
        "description": "Execute the website audit across all domains per SOP-104.",
        "items": [
            {
                "subject": "Conduct website audit",
                "description": (
                    "Run the full website audit across all 9 domains defined in SOP-104: "
                    "Technical SEO, On-Page SEO, Performance, Mobile, Accessibility, "
                    "Security, Analytics, UX, and AI Integration. "
                    "Record findings as you go."
                ),
                "item_type": "task",
                "priority": "high",
                "sequence": 1,
            },
            {
                "subject": "Run Sanctum Audit baseline scan",
                "description": (
                    "Trigger the automated Sanctum Audit baseline scan for the client's "
                    "website. This is handled automatically when the template is applied "
                    "if the account has a website URL on record. Verify the scan completed "
                    "and review the report."
                ),
                "item_type": "task",
                "priority": "normal",
                "sequence": 2,
            },
        ],
    },
    {
        "name": "Write Report",
        "sequence": 2,
        "description": "Write and review the audit report using the DOC-053 template.",
        "items": [
            {
                "subject": "Write audit report",
                "description": (
                    "Using the DOC-053 Website Audit Report Template, write findings "
                    "for each audit domain. Score each domain 1-10. Write the executive "
                    "summary and prioritised recommendations."
                ),
                "item_type": "task",
                "priority": "normal",
                "sequence": 1,
            },
            {
                "subject": "Review and approve audit report",
                "description": (
                    "Review the completed audit report for accuracy and completeness. "
                    "Promote the report artefact from draft to review, then to approved "
                    "once satisfied."
                ),
                "item_type": "task",
                "priority": "normal",
                "sequence": 2,
            },
        ],
    },
    {
        "name": "Remediation",
        "sequence": 3,
        "description": "Create remediation tickets from findings and deliver the report to the client.",
        "items": [
            {
                "subject": "Create remediation tickets from audit findings",
                "description": (
                    "Review the audit report's recommendations and create individual "
                    "tickets for each remediation item. Group by severity or domain. "
                    "Link each remediation ticket to the audit report artefact."
                ),
                "item_type": "task",
                "priority": "normal",
                "sequence": 1,
            },
            {
                "subject": "Deliver report to client",
                "description": (
                    "Export or present the approved audit report artefact to the client. "
                    "Schedule a walkthrough session if appropriate."
                ),
                "item_type": "task",
                "priority": "normal",
                "sequence": 2,
            },
        ],
    },
]


# ---------------------------------------------------------------------------
# INSERT
# ---------------------------------------------------------------------------

try:
    template = models.Template(
        name=TEMPLATE_NAME,
        description=(
            "Scaffolds the full SOP-104 website audit workflow: conduct audit across "
            "9 domains, write and review the report, then create remediation tickets. "
            "Automatically triggers a Sanctum Audit baseline scan on apply."
        ),
        template_type="project",
        category="audit",
        tags=["audit", "website", "sop-104", "baseline-scan"],
        icon="magnifying-glass",
    )
    db.add(template)
    db.flush()

    total_items = 0
    for sec_data in SECTIONS:
        section = models.TemplateSection(
            template_id=template.id,
            name=sec_data["name"],
            description=sec_data.get("description"),
            sequence=sec_data["sequence"],
        )
        db.add(section)
        db.flush()

        for item_data in sec_data["items"]:
            item = models.TemplateItem(
                section_id=section.id,
                subject=item_data["subject"],
                description=item_data.get("description"),
                item_type=item_data.get("item_type", "task"),
                priority=item_data.get("priority", "normal"),
                sequence=item_data.get("sequence", 1),
            )
            db.add(item)
            total_items += 1

    db.commit()
    print(f"Template seeded: '{TEMPLATE_NAME}'")
    print(f"  ID:       {template.id}")
    print(f"  Category: {template.category}")
    print(f"  Sections: {len(SECTIONS)}")
    print(f"  Items:    {total_items}")
    print(f"  Tags:     {', '.join(template.tags)}")

except Exception as e:
    db.rollback()
    print(f"Seed failed: {e}")
    raise
finally:
    db.close()

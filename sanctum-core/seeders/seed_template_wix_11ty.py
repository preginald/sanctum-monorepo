#!/usr/bin/env python3
"""
Seed: Website Rebuild — Wix → 11ty (Psychology Practice)
First real-world seed for The Blueprint / Universal Template Library.

Run from: ~/Dev/DigitalSanctum/sanctum-core/
Usage:    python seed_template_wix_11ty.py
"""

import sys
import os

# Make sure we can import the app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app import models

db = SessionLocal()

TEMPLATE_NAME = "Website Rebuild — Existing Site → 11ty"

# Guard: don't seed twice
existing = db.query(models.Template).filter(
    models.Template.name == TEMPLATE_NAME
).first()

if existing:
    print(f"✗ Template already exists: '{TEMPLATE_NAME}' ({existing.id})")
    print("  Delete it first if you want to re-seed.")
    db.close()
    sys.exit(0)


# ─────────────────────────────────────────────────────────────────────────────
# TEMPLATE DEFINITION
# ─────────────────────────────────────────────────────────────────────────────

SECTIONS = [
    {
        "name": "Discovery & Scoping",
        "sequence": 1,
        "description": "Understand the client's goals, current site, and define the project scope.",
        "items": [
            {
                "subject": "Initial consult call",
                "description": "Kick-off meeting with client. Cover goals, timeline, budget, and tech preferences. Record key decisions.",
                "item_type": "task",
                "priority": "high",
                "sequence": 1,
            },
            {
                "subject": "Content audit of existing site",
                "description": "Inventory all existing pages, images, and copy. Identify what carries over vs what is rewritten.",
                "item_type": "task",
                "priority": "normal",
                "sequence": 2,
            },
            {
                "subject": "Sitemap planning",
                "description": "Define the new site architecture. Agree on page names, hierarchy, and navigation structure with client.",
                "item_type": "task",
                "priority": "normal",
                "sequence": 3,
            },
            {
                "subject": "Scoping sign-off",
                "description": "Client signs off on scope document before design begins. Document any out-of-scope requests.",
                "item_type": "task",
                "priority": "high",
                "sequence": 4,
            },
        ],
    },
    {
        "name": "Design & Wireframes",
        "sequence": 2,
        "description": "Create lo-fi wireframes, iterate with client, and get design sign-off before development.",
        "items": [
            {
                "subject": "Lo-fi wireframes (key pages)",
                "description": "Wireframe homepage, services, about, contact. Use Figma or similar. Focus on layout not aesthetics.",
                "item_type": "task",
                "priority": "normal",
                "sequence": 1,
            },
            {
                "subject": "Client wireframe review",
                "description": "Present wireframes to client. Capture feedback, requested changes, and clarify any ambiguity.",
                "item_type": "task",
                "priority": "normal",
                "sequence": 2,
            },
            {
                "subject": "Hi-fi design (if applicable)",
                "description": "Apply brand colours, typography, imagery. Deliver Figma mockup or design brief for developer.",
                "item_type": "task",
                "priority": "normal",
                "sequence": 3,
            },
            {
                "subject": "Design sign-off",
                "description": "Client formally approves design direction before development begins. Email confirmation is sufficient.",
                "item_type": "task",
                "priority": "high",
                "sequence": 4,
            },
        ],
    },
    {
        "name": "11ty Development",
        "sequence": 3,
        "description": "Scaffold the 11ty project, build all pages, and configure any CMS or data layer.",
        "items": [
            {
                "subject": "Scaffold 11ty project & repo",
                "description": "Init repo, install 11ty, configure Nunjucks/Liquid templates, Tailwind CSS, and base layouts. Push to GitHub.",
                "item_type": "task",
                "priority": "high",
                "sequence": 1,
            },
            {
                "subject": "Build core page templates",
                "description": "Implement homepage, services, about, contact. Wire up navigation. Ensure responsive on mobile.",
                "item_type": "feature",
                "priority": "high",
                "sequence": 2,
            },
            {
                "subject": "Configure CMS or data layer",
                "description": "If client needs content editing: set up Decap CMS, Netlify CMS, or equivalent. Document the editing workflow.",
                "item_type": "feature",
                "priority": "normal",
                "sequence": 3,
            },
            {
                "subject": "Accessibility & performance audit",
                "description": "Run Lighthouse. Target 90+ on performance, accessibility, best practices. Fix critical issues.",
                "item_type": "task",
                "priority": "normal",
                "sequence": 4,
            },
            {
                "subject": "Contact form & integrations",
                "description": "Wire up contact form (Netlify Forms, Formspree, or similar). Test email delivery. Add any booking/calendar embeds.",
                "item_type": "feature",
                "priority": "normal",
                "sequence": 5,
            },
        ],
    },
    {
        "name": "Content Migration",
        "sequence": 4,
        "description": "Migrate copy, images, and metadata from the existing site to the new 11ty build.",
        "items": [
            {
                "subject": "Copy migration & rewrite",
                "description": "Port all approved copy from old site. Rewrite or update any outdated content as directed by client.",
                "item_type": "task",
                "priority": "normal",
                "sequence": 1,
            },
            {
                "subject": "Image optimisation",
                "description": "Export and optimise all images (WebP, appropriate sizing). Use 11ty image plugin or equivalent.",
                "item_type": "task",
                "priority": "normal",
                "sequence": 2,
            },
            {
                "subject": "SEO metadata",
                "description": "Add meta titles, descriptions, Open Graph tags per page. Submit sitemap.xml. Configure robots.txt.",
                "item_type": "task",
                "priority": "high",
                "sequence": 3,
            },
            {
                "subject": "Redirect mapping",
                "description": "Map old Wix URLs to new URLs. Configure 301 redirects to preserve SEO equity. Document all redirects.",
                "item_type": "task",
                "priority": "high",
                "sequence": 4,
            },
        ],
    },
    {
        "name": "QA & Client Review",
        "sequence": 5,
        "description": "Full quality assurance pass, client walkthrough, and amendment cycle before launch.",
        "items": [
            {
                "subject": "Cross-browser & device testing",
                "description": "Test on Chrome, Safari, Firefox, Edge. Test on iOS and Android. Check tablet layout. Document and fix failures.",
                "item_type": "task",
                "priority": "high",
                "sequence": 1,
            },
            {
                "subject": "Client walkthrough session",
                "description": "Screen-share walkthrough of staging site with client. Capture all requested changes in a feedback log.",
                "item_type": "task",
                "priority": "high",
                "sequence": 2,
            },
            {
                "subject": "Amendments round 1",
                "description": "Implement agreed changes from client walkthrough. Confirm scope — additional requests beyond agreed rounds may incur cost.",
                "item_type": "task",
                "priority": "normal",
                "sequence": 3,
            },
            {
                "subject": "Final client sign-off",
                "description": "Client formally approves staging site. Written confirmation (email) required before DNS cutover proceeds.",
                "item_type": "task",
                "priority": "high",
                "sequence": 4,
            },
        ],
    },
    {
        "name": "Launch & Handover",
        "sequence": 6,
        "description": "DNS cutover, post-launch smoke test, and client handover documentation.",
        "items": [
            {
                "subject": "DNS cutover",
                "description": "Point domain to new host. Update DNS records (A, CNAME, MX if applicable). Monitor propagation. Confirm HTTPS.",
                "item_type": "task",
                "priority": "high",
                "sequence": 1,
            },
            {
                "subject": "Post-launch smoke test",
                "description": "Verify all pages load, forms submit, redirects resolve, and analytics are firing on production domain.",
                "item_type": "task",
                "priority": "high",
                "sequence": 2,
            },
            {
                "subject": "Google Search Console & Analytics setup",
                "description": "Verify site in GSC. Submit sitemap. Confirm GA4 or equivalent is tracking. Set up uptime monitor.",
                "item_type": "task",
                "priority": "normal",
                "sequence": 3,
            },
            {
                "subject": "Handover documentation",
                "description": "Deliver handover doc: repo URL, hosting credentials, CMS login, DNS details, content editing guide. Store in client portal.",
                "item_type": "task",
                "priority": "high",
                "sequence": 4,
            },
            {
                "subject": "Decommission old Wix site",
                "description": "After confirming new site is live and stable (recommend 14-day buffer), cancel Wix subscription. Confirm with client.",
                "item_type": "task",
                "priority": "normal",
                "sequence": 5,
            },
        ],
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# INSERT
# ─────────────────────────────────────────────────────────────────────────────

try:
    template = models.Template(
        name=TEMPLATE_NAME,
        description=(
            "End-to-end project template for migrating a client from an existing website "
            "(e.g. Wix, Squarespace, WordPress) to a modern static site built with 11ty. "
            "Covers discovery, design, development, content migration, QA, and launch."
        ),
        template_type="project",
        category="web",
        tags=["11ty", "website-rebuild", "wix-migration", "static-site", "web-design"],
        icon="🏗️",
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
    print(f"✓ Template seeded: '{TEMPLATE_NAME}'")
    print(f"  ID:       {template.id}")
    print(f"  Sections: {len(SECTIONS)}")
    print(f"  Items:    {total_items}")
    print(f"  Tags:     {', '.join(template.tags)}")

except Exception as e:
    db.rollback()
    print(f"✗ Seed failed: {e}")
    raise
finally:
    db.close()

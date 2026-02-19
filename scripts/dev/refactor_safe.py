import os

FILES = [
    "sanctum-web/src/pages/Tickets.jsx",
    "sanctum-web/src/pages/Clients.jsx",
    "sanctum-web/src/pages/AdminAutomationList.jsx",
    "sanctum-web/src/pages/AdminQuestionnaireList.jsx",
    "sanctum-web/src/pages/AdminUserList.jsx",
    "sanctum-web/src/pages/AssetLifecycle.jsx",
    "sanctum-web/src/pages/AuditIndex.jsx",
    "sanctum-web/src/pages/CampaignDetail.jsx",
    "sanctum-web/src/pages/Catalog.jsx",
    "sanctum-web/src/pages/Diagnostics.jsx",
    "sanctum-web/src/pages/InvoiceDetail.jsx",
    "sanctum-web/src/pages/PortalAssets.jsx",
    "sanctum-web/src/pages/SystemHealth.jsx",
    "sanctum-web/src/pages/UnpaidInvoices.jsx"
]

TAG_MAP = {
    "table": "Table",
    "thead": "TableHeader",
    "tbody": "TableBody",
    "tfoot": "TableFooter",
    "tr":    "TableRow",
    "th":    "TableHead",
    "td":    "TableCell"
}

IMPORT_STMT = "import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';"

def refactor_file(filepath):
    if not os.path.exists(filepath):
        print(f"❌ Missing: {filepath}")
        return

    with open(filepath, 'r') as f:
        content = f.read()

    # Safety check
    if "<Table " in content or "<Table>" in content:
        print(f"⚠️  Skipping {filepath} (Already has Table component)")
        return

    # 1. Inject Import (Idempotent-ish)
    if "components/ui/Table" not in content:
        # Try inserting after Layout to keep imports clean
        if "import Layout" in content:
            content = content.replace("import Layout", "import Layout" + "\n" + IMPORT_STMT)
        elif "import React" in content:
            content = content.replace("import React", IMPORT_STMT + "\n" + "import React")
        else:
            content = IMPORT_STMT + "\n" + content

    # 2. Literal Replacements (Order matters to avoid partial matches)
    for html, react in TAG_MAP.items():
        # Closing tags first (Simple)
        content = content.replace(f"</{html}>", f"</{react}>")
        
        # Opening tags - Explicit boundaries to avoid merging text
        # Variant A: Tag with attributes (followed by space) -> <table class... becomes <Table class...
        content = content.replace(f"<{html} ", f"<{react} ")
        
        # Variant B: Tag with newline (followed by \n) -> <tr\n becomes <TableRow\n
        content = content.replace(f"<{html}\n", f"<{react}\n")
        
        # Variant C: Tag self-contained (followed by >) -> <table> becomes <Table>
        content = content.replace(f"<{html}>", f"<{react}>")

    with open(filepath, 'w') as f:
        f.write(content)
    print(f"✅ Refactored: {filepath}")

if __name__ == "__main__":
    print("🚀 Starting Safe Refactor...")
    for f in FILES:
        refactor_file(f)

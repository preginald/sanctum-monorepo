#!/bin/bash
# fix_legacy_billing.sh
# Backfills the 'invoice_id' on TimeEntries and Materials based on existing InvoiceItems.

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

ENV_PATH="sanctum-core/.env"

# 1. Get Database URL
if [ ! -f "$ENV_PATH" ]; then
    echo "❌ .env not found."
    exit 1
fi

DB_URL=$(grep '^DATABASE_URL=' "$ENV_PATH" | cut -d '=' -f2- | xargs)

echo -e "${BLUE}=== STARTING LEGACY BILLING FIX ===${NC}"

# 2. Execute SQL Update
psql "$DB_URL" <<EOF
BEGIN;

-- 1. Backfill Time Entries
UPDATE ticket_time_entries
SET invoice_id = invoice_items.invoice_id
FROM invoice_items
WHERE ticket_time_entries.id = invoice_items.source_id
AND invoice_items.source_type = 'time'
AND ticket_time_entries.invoice_id IS NULL;

-- 2. Backfill Materials
UPDATE ticket_materials
SET invoice_id = invoice_items.invoice_id
FROM invoice_items
WHERE ticket_materials.id = invoice_items.source_id
AND invoice_items.source_type = 'material'
AND ticket_materials.invoice_id IS NULL;

COMMIT;
EOF

echo -e "${GREEN}=== MIGRATION COMPLETE ===${NC}"
echo "Legacy items have been linked to their invoices."
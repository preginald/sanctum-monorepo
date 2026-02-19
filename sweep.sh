#!/bin/bash
# Fix mangled Table/Layout imports across 13 files

BASE=~/Dev/DigitalSanctum/sanctum-web/src/pages
COUNT=0

echo "🔧 Fixing mangled imports..."

for FILE in "$BASE"/*.jsx; do
    if grep -q "from '../components/ui/Table'; from '../components/Layout';" "$FILE"; then
        # Fix the mangled line: split into two proper imports
        sed -i "s|import Layout$|import Layout from '../components/Layout';|" "$FILE"
        sed -i "s|import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table'; from '../components/Layout';|import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';|" "$FILE"
        echo "  ✓ $(basename $FILE)"
        ((COUNT++))
    fi
done

echo ""
echo "  ✅ Fixed $COUNT files"

# Verify no broken imports remain
echo ""
echo "=== Verification ==="
REMAINING=$(grep -rn "from.*Table.*from.*Layout" "$BASE"/*.jsx 2>/dev/null | wc -l)
echo "  Broken imports remaining: $REMAINING"

# Build check
echo ""
cd ~/Dev/DigitalSanctum/sanctum-web && npx vite build 2>&1 | tail -3

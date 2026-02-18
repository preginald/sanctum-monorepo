#!/bin/bash
# Fix portal impersonation across all Portal pages
# Applies usePortalNav hook and passes impersonate param to all API calls

BASE=~/Dev/DigitalSanctum/sanctum-web/src/pages

echo "=== Fixing Portal Impersonation ==="

# --- PortalAuditReport.jsx ---
FILE="$BASE/PortalAuditReport.jsx"
echo "Patching $FILE..."

# Add import (after the last import line)
if ! grep -q "usePortalNav" "$FILE"; then
  sed -i "/^import.*from 'react-router-dom'/a import usePortalNav from '../hooks/usePortalNav';" "$FILE"
fi

# Add hook after navigate
if ! grep -q "portalNav" "$FILE"; then
  sed -i "/const navigate = useNavigate/a\\  const { portalNav, impersonateId } = usePortalNav();" "$FILE"
fi

# Fix API calls
sed -i "s|api.get('/portal/dashboard')|api.get(\`/portal/dashboard\${impersonateId ? '?impersonate=' + impersonateId : ''}\`)|g" "$FILE"

# Fix navigations
sed -i "s|navigate('/portal/dashboard')|portalNav('/portal')|g" "$FILE"
sed -i "s|navigate('/portal')|portalNav('/portal')|g" "$FILE"

echo "  ✓ PortalAuditReport.jsx"

# --- PortalSecurityReport.jsx ---
FILE="$BASE/PortalSecurityReport.jsx"
echo "Patching $FILE..."

if ! grep -q "usePortalNav" "$FILE"; then
  # Check if it uses useNavigate
  if grep -q "useNavigate" "$FILE"; then
    sed -i "/^import.*from 'react-router-dom'/a import usePortalNav from '../hooks/usePortalNav';" "$FILE"
  else
    # Add both imports
    sed -i "1a import usePortalNav from '../hooks/usePortalNav';" "$FILE"
  fi
fi

# Add hook - find the component function and add after first const
if ! grep -q "impersonateId" "$FILE"; then
  if grep -q "const navigate = useNavigate" "$FILE"; then
    sed -i "/const navigate = useNavigate/a\\  const { portalNav, impersonateId } = usePortalNav();" "$FILE"
  else
    # Try adding after first useState
    sed -i "0,/const \[/{s/const \[/const { portalNav, impersonateId } = usePortalNav();\n  const [/}" "$FILE"
  fi
fi

sed -i "s|api.get('/portal/dashboard')|api.get(\`/portal/dashboard\${impersonateId ? '?impersonate=' + impersonateId : ''}\`)|g" "$FILE"
sed -i "s|navigate('/portal/dashboard')|portalNav('/portal')|g" "$FILE"
sed -i "s|navigate('/portal')|portalNav('/portal')|g" "$FILE"

echo "  ✓ PortalSecurityReport.jsx"

# --- PortalDashboard.jsx (invoice download) ---
FILE="$BASE/PortalDashboard.jsx"
echo "Patching $FILE..."

# Already has usePortalNav, just fix the invoice download
sed -i "s|api.get(\`/portal/invoices/\${invoiceId}/download\`|api.get(\`/portal/invoices/\${invoiceId}/download\${impersonateId ? '?impersonate=' + impersonateId : ''}\`|g" "$FILE"

echo "  ✓ PortalDashboard.jsx"

# --- PortalTicketDetail.jsx (invoice download + comments) ---
FILE="$BASE/PortalTicketDetail.jsx"
echo "Patching $FILE..."

# Fix invoice download
sed -i "s|api.get(\`/portal/invoices/\${invoiceId}/download\`|api.get(\`/portal/invoices/\${invoiceId}/download\${impersonateId ? '?impersonate=' + impersonateId : ''}\`|g" "$FILE"

# Fix comment post
sed -i "s|api.post(\`/portal/tickets/\${id}/comments\`|api.post(\`/portal/tickets/\${id}/comments\${impersonateId ? '?impersonate=' + impersonateId : ''}\`|g" "$FILE"

echo "  ✓ PortalTicketDetail.jsx"

# --- PortalQuestionnaire.jsx ---
FILE="$BASE/PortalQuestionnaire.jsx"
echo "Patching $FILE..."

if ! grep -q "usePortalNav" "$FILE"; then
  if grep -q "from 'react-router-dom'" "$FILE"; then
    sed -i "/^import.*from 'react-router-dom'/a import usePortalNav from '../hooks/usePortalNav';" "$FILE"
  else
    sed -i "1a import usePortalNav from '../hooks/usePortalNav';" "$FILE"
  fi
fi

if ! grep -q "impersonateId" "$FILE"; then
  if grep -q "const navigate = useNavigate" "$FILE"; then
    sed -i "/const navigate = useNavigate/a\\  const { portalNav, impersonateId } = usePortalNav();" "$FILE"
  fi
fi

sed -i "s|api.post('/portal/questionnaire/submit'|api.post(\`/portal/questionnaire/submit\${impersonateId ? '?impersonate=' + impersonateId : ''}\`|g" "$FILE"
sed -i "s|navigate('/portal')|portalNav('/portal')|g" "$FILE"

echo "  ✓ PortalQuestionnaire.jsx"

echo ""
echo "=== Verification ==="
echo "Remaining unpatched portal API calls:"
grep -rn "api.get.*portal\|api.post.*portal" $BASE/Portal*.jsx | grep -v "impersonate" | grep -v "node_modules" || echo "  None found - all clear!"

echo ""
echo "Done. Test and deploy."

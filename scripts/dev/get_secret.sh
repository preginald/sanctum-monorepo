#!/bin/bash
# get_secret.sh v2.0 - Extract TOTP seed + optional QR generation
# Usage: ./get_secret.sh [email] [generate_qr]
# Example: ./get_secret.sh peter@digitalsanctum.com.au true

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
ENV_PATH="sanctum-core/.env"
EMAIL="${1:-peter@digitalsanctum.com.au}"
GENERATE_QR="${2:-false}"

# Validate .env exists
if [ ! -f "$ENV_PATH" ]; then
    echo "❌ Error: .env file not found at $ENV_PATH"
    echo "Current directory: $(pwd)"
    exit 1
fi

# Extract DATABASE_URL
DB_URL=$(grep '^DATABASE_URL=' "$ENV_PATH" | cut -d '=' -f2- | xargs)

if [ -z "$DB_URL" ]; then
    echo "❌ Error: DATABASE_URL not found in $ENV_PATH"
    exit 1
fi

echo "🔍 Searching for TOTP secret for: $EMAIL"

# Query database
SECRET=$(psql "$DB_URL" -t -A -c "SELECT totp_secret FROM users WHERE email='$EMAIL';")

if [ -z "$SECRET" ] || [ "$SECRET" == "NULL" ]; then
    echo "----------------------------------------"
    echo "❌ No secret found for $EMAIL."
    echo "Verify: 1. The email is correct. 2. 2FA is enabled for this user."
    echo "----------------------------------------"
    exit 1
fi

echo "----------------------------------------"
echo -e "✅ Found Secret: ${GREEN}$SECRET${NC}"
echo "----------------------------------------"

# Export command
echo ""
echo -e "${BLUE}Quick Export:${NC}"
echo "export SANCTUM_TOTP_SECRET=$SECRET"

# Copy to clipboard
echo ""
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "$SECRET" | pbcopy
    echo -e "${GREEN}✓ Secret copied to macOS clipboard${NC}"
elif command -v xclip &> /dev/null; then
    echo "$SECRET" | xclip -selection clipboard
    echo -e "${GREEN}✓ Secret copied to Linux clipboard${NC}"
fi

# Generate QR code for mobile setup
if [ "$GENERATE_QR" == "true" ]; then
    if command -v qrencode &> /dev/null; then
        ISSUER="DigitalSanctum"
        OTP_URI="otpauth://totp/${ISSUER}:${EMAIL}?secret=${SECRET}&issuer=${ISSUER}"
        
        echo ""
        echo -e "${BLUE}QR Code (scan with authenticator app):${NC}"
        qrencode -t ANSIUTF8 "$OTP_URI"
        echo ""
        echo -e "${BLUE}Manual Entry:${NC} $SECRET"
    else
        echo ""
        echo -e "${YELLOW}⚠ qrencode not installed. Install with:${NC}"
        echo "  macOS: brew install qrencode"
        echo "  Linux: sudo apt install qrencode"
    fi
fi

# Generate current TOTP code for immediate testing
if command -v oathtool &> /dev/null; then
    CURRENT_CODE=$(oathtool --totp -b "$SECRET")
    echo ""
    echo -e "${GREEN}Current TOTP Code:${NC} $CURRENT_CODE"
    echo -e "${BLUE}(Valid for ~30 seconds)${NC}"
else
    echo ""
    echo -e "${YELLOW}💡 Tip: Install oathtool to see current TOTP code${NC}"
    echo "  macOS: brew install oath-toolkit"
    echo "  Linux: sudo apt install oathtool"
fi

echo ""

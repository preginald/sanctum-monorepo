#!/bin/bash
# get_secret.sh - Extract TOTP seed for a specific user

# 1. Resolve the .env path (Looking into sanctum-core relative to project root)
# This assumes you run the script from the DigitalSanctum root
ENV_PATH="sanctum-core/.env"

if [ ! -f "$ENV_PATH" ]; then
    echo "❌ Error: .env file not found at $ENV_PATH"
    echo "Current directory: $(pwd)"
    exit 1
fi

# 2. Extract DATABASE_URL
DB_URL=$(grep '^DATABASE_URL=' "$ENV_PATH" | cut -d '=' -f2- | xargs)

if [ -z "$DB_URL" ]; then
    echo "❌ Error: DATABASE_URL not found in $ENV_PATH"
    exit 1
fi

EMAIL="${1:-peter@digitalsanctum.com.au}"

echo "🔍 Searching for TOTP secret for: $EMAIL"

# 3. Query the Database
# We use -t (tuples only) and -A (unaligned) for a clean string output
SECRET=$(psql "$DB_URL" -t -A -c "SELECT totp_secret FROM users WHERE email='$EMAIL';")

if [ -z "$SECRET" ] || [ "$SECRET" == "NULL" ]; then
    echo "----------------------------------------"
    echo "❌ No secret found for $EMAIL."
    echo "Verify: 1. The email is correct. 2. 2FA is enabled for this user."
    echo "----------------------------------------"
else
    echo "----------------------------------------"
    echo -e "✅ Found Secret: \033[0;32m$SECRET\033[0m"
    echo "----------------------------------------"
    echo "To use this in your current session, run:"
    echo "export SANCTUM_TOTP_SECRET=$SECRET"
fi

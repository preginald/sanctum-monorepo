#!/usr/bin/env bash
#
# Smoke-test the Sanctum Core M2M auth path (#2793).
#
# Fetches an OAuth2 Client-Credentials token from Sanctum Auth and calls
# GET /api/artefacts?category=mockup&limit=1 on Sanctum Core — asserts 200.
# Idempotent: safe to re-run. Exits non-zero on any failure.
#
# Required env vars:
#   SANCTUM_AUTH_CLIENT_ID      — M2M client_id registered on auth.digitalsanctum.com.au
#   SANCTUM_AUTH_CLIENT_SECRET  — matching client_secret
#
# Optional env vars:
#   OIDC_ISSUER     — defaults to https://auth.digitalsanctum.com.au
#   CORE_URL        — defaults to https://core.digitalsanctum.com.au
#   SCOPE           — space-delimited OAuth2 scopes, defaults to "artefacts:read"
#
# Example:
#   SANCTUM_AUTH_CLIENT_ID=xxx SANCTUM_AUTH_CLIENT_SECRET=yyy ./scripts/smoke_m2m.sh

set -euo pipefail

: "${SANCTUM_AUTH_CLIENT_ID:?SANCTUM_AUTH_CLIENT_ID must be set}"
: "${SANCTUM_AUTH_CLIENT_SECRET:?SANCTUM_AUTH_CLIENT_SECRET must be set}"

OIDC_ISSUER="${OIDC_ISSUER:-https://auth.digitalsanctum.com.au}"
CORE_URL="${CORE_URL:-https://core.digitalsanctum.com.au}"
SCOPE="${SCOPE:-artefacts:read}"

echo "[smoke_m2m] Fetching M2M access token from ${OIDC_ISSUER}/oauth/token ..."
TOKEN_RESPONSE=$(
    curl --fail --silent --show-error \
        -u "${SANCTUM_AUTH_CLIENT_ID}:${SANCTUM_AUTH_CLIENT_SECRET}" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "grant_type=client_credentials&scope=${SCOPE// /+}" \
        "${OIDC_ISSUER}/oauth/token"
)

if command -v jq >/dev/null 2>&1; then
    ACCESS_TOKEN=$(echo "${TOKEN_RESPONSE}" | jq -r .access_token)
else
    # jq-free extraction for CI containers that haven't installed it.
    ACCESS_TOKEN=$(echo "${TOKEN_RESPONSE}" \
        | sed -n 's/.*"access_token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
fi

if [[ -z "${ACCESS_TOKEN}" || "${ACCESS_TOKEN}" == "null" ]]; then
    echo "[smoke_m2m] FAIL: could not extract access_token from response" >&2
    echo "${TOKEN_RESPONSE}" >&2
    exit 2
fi
echo "[smoke_m2m] Got M2M access token (${#ACCESS_TOKEN} chars)."

TARGET_URL="${CORE_URL}/api/artefacts?category=mockup&limit=1"
echo "[smoke_m2m] Calling ${TARGET_URL} ..."

HTTP_CODE=$(
    curl --silent --show-error \
        -o /tmp/smoke_m2m_body.$$ \
        -w "%{http_code}" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        "${TARGET_URL}"
)

if [[ "${HTTP_CODE}" != "200" ]]; then
    echo "[smoke_m2m] FAIL: expected HTTP 200, got ${HTTP_CODE}" >&2
    echo "--- response body ---" >&2
    cat "/tmp/smoke_m2m_body.$$" >&2
    rm -f "/tmp/smoke_m2m_body.$$"
    exit 3
fi

rm -f "/tmp/smoke_m2m_body.$$"
echo "[smoke_m2m] PASS — Core accepted the M2M access token (HTTP 200)."

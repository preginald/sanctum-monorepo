# Sanctum Utility Scripts

Operational and development utilities for Sanctum Core.

---

## Directory Structure
```
scripts/
├── dev/                  # Development helpers
│   ├── get_secret.sh     # Extract TOTP secrets (v2.0)
│   ├── auth_test.sh      # Authenticate & test API (v2.0)
│   └── api_test.sh       # Generic API tester (v2.0)
└── admin/                # Admin utilities (future)
```

---

## Quick Start

### 1. First-Time Authentication
```bash
# Interactive mode
./scripts/dev/auth_test.sh

# Or with credentials
./scripts/dev/auth_test.sh user@example.com password123
```

### 2. Test API Endpoints
```bash
# GET request
./scripts/dev/api_test.sh GET /sentinel/templates

# POST request
./scripts/dev/api_test.sh POST /tickets '{"subject":"Test"}'
```

---

## Development Scripts

### get_secret.sh v2.0
Extract TOTP secret from database for 2FA testing.

**Usage:**
```bash
# Basic - get secret
./scripts/dev/get_secret.sh user@example.com

# With QR code generation
./scripts/dev/get_secret.sh user@example.com true
```

**Features:**
- Auto-copy secret to clipboard
- Generate current TOTP code (requires `oathtool`)
- Display QR code for mobile setup (requires `qrencode`)
- Export command for environment variable

**Dependencies (optional but recommended):**
```bash
# macOS
brew install oath-toolkit qrencode

# Ubuntu/Debian
sudo apt install oathtool qrencode
```

**Output:**
```
🔍 Searching for TOTP secret for: user@example.com
----------------------------------------
✅ Found Secret: JBSWY3DPEHPK3PXP
----------------------------------------

Quick Export:
export SANCTUM_TOTP_SECRET=JBSWY3DPEHPK3PXP

✓ Secret copied to clipboard

Current TOTP Code: 123456
(Valid for ~30 seconds)
```

---

### auth_test.sh v2.0
Authenticate with API, handle 2FA, save token, and test endpoints.

**Usage:**
```bash
# Interactive mode
./scripts/dev/auth_test.sh

# Non-interactive mode
./scripts/dev/auth_test.sh user@example.com password123

# With profile
SANCTUM_PROFILE=admin ./scripts/dev/auth_test.sh admin@example.com password
```

**Features:**
- ✅ **Profile Management** - Multiple tokens for different users
- ✅ **Token Validation** - Reuse existing valid tokens
- ✅ **Auto-TOTP** - Generate 2FA codes automatically if `SANCTUM_TOTP_SECRET` is set
- ✅ **Persistent Storage** - Tokens saved in `~/.sanctum/tokens/`
- ✅ **Metadata Tracking** - Records email, creation time, API base per profile

**Token Storage:**
```
~/.sanctum/tokens/
├── default.txt          # Default profile token
├── default.json         # Default profile metadata
├── admin.txt            # Admin profile token
└── admin.json           # Admin profile metadata
```

**Auto-TOTP Workflow:**
```bash
# 1. Get secret
export SANCTUM_TOTP_SECRET=$(./scripts/dev/get_secret.sh user@example.com | grep "export" | cut -d '=' -f2)

# 2. Authenticate (auto-generates TOTP codes)
./scripts/dev/auth_test.sh user@example.com password
```

**Multi-Profile Example:**
```bash
# Create admin token
SANCTUM_PROFILE=admin ./scripts/dev/auth_test.sh admin@example.com password

# Create client token
SANCTUM_PROFILE=client ./scripts/dev/auth_test.sh client@example.com password

# Use admin token
SANCTUM_PROFILE=admin ./scripts/dev/api_test.sh GET /admin/users

# Use client token
SANCTUM_PROFILE=client ./scripts/dev/api_test.sh GET /portal/dashboard
```

---

### api_test.sh v2.0
Generic API testing utility using saved tokens.

**Usage:**
```bash
# GET request
./scripts/dev/api_test.sh GET /sentinel/templates

# POST request
./scripts/dev/api_test.sh POST /tickets '{"subject":"Test Ticket"}'

# PUT request
./scripts/dev/api_test.sh PUT /tickets/123 '{"status":"resolved"}'

# DELETE request
./scripts/dev/api_test.sh DELETE /tickets/123

# Verbose mode with logging
VERBOSE=true ./scripts/dev/api_test.sh GET /portal/dashboard
```

**Features:**
- ✅ **Request Logging** - All requests logged to `~/.sanctum/logs/`
- ✅ **Timing Metrics** - Response time in milliseconds
- ✅ **HTTP Status Colors** - Visual feedback (green=success, red=error)
- ✅ **Profile Support** - Works with multi-profile tokens
- ✅ **Exit Codes** - Non-zero exit on HTTP errors (useful for scripting)
- ✅ **JSON Validation** - Auto-pretty-print valid JSON responses

**Logging:**
```bash
# All requests logged to
~/.sanctum/logs/request_20260210_143025.log

# View recent logs
ls -lht ~/.sanctum/logs/ | head -5

# Tail latest log
tail -f ~/.sanctum/logs/request_*.log
```

**Common API Endpoints:**
```bash
# Sentinel
./scripts/dev/api_test.sh GET /sentinel/templates
./scripts/dev/api_test.sh GET /sentinel/audits
./scripts/dev/api_test.sh POST /sentinel/audits '{"template_id":"..."}'

# Portal
./scripts/dev/api_test.sh GET /portal/dashboard
./scripts/dev/api_test.sh GET /portal/assessments
./scripts/dev/api_test.sh POST /portal/assessments/request '{"template_id":"..."}'

# Tickets
./scripts/dev/api_test.sh GET /tickets
./scripts/dev/api_test.sh POST /tickets '{"subject":"Test","priority":"normal"}'
./scripts/dev/api_test.sh PUT /tickets/123 '{"status":"resolved"}'

# System
./scripts/dev/api_test.sh GET /
./scripts/dev/api_test.sh GET /docs
```

---

## Environment Variables

### API_BASE
Base URL for API (default: `http://localhost:8000`)

```bash
# Local development
export API_BASE="http://localhost:8000"

# Production testing
export API_BASE="https://core.digitalsanctum.com.au"
```

### SANCTUM_PROFILE
Profile name for multi-user token management (default: `default`)

```bash
# Use admin profile
SANCTUM_PROFILE=admin ./scripts/dev/auth_test.sh
SANCTUM_PROFILE=admin ./scripts/dev/api_test.sh GET /admin/users
```

### SANCTUM_TOTP_SECRET
TOTP secret for auto-generating 2FA codes

```bash
# Set once per session
export SANCTUM_TOTP_SECRET=JBSWY3DPEHPK3PXP

# Or inline
SANCTUM_TOTP_SECRET=JBSWY3DPEHPK3PXP ./scripts/dev/auth_test.sh user@example.com password
```

### VERBOSE
Enable verbose output and detailed logging (default: `false`)

```bash
VERBOSE=true ./scripts/dev/api_test.sh GET /portal/dashboard
```

---

## Workflows

### New User Testing Flow
```bash
# 1. Get TOTP secret
./scripts/dev/get_secret.sh newuser@example.com

# 2. Set as environment variable
export SANCTUM_TOTP_SECRET=<secret_from_step_1>

# 3. Authenticate (auto-TOTP)
./scripts/dev/auth_test.sh newuser@example.com password

# 4. Test endpoints
./scripts/dev/api_test.sh GET /portal/dashboard
```

### Multi-Environment Testing
```bash
# Local
API_BASE=http://localhost:8000 ./scripts/dev/auth_test.sh
API_BASE=http://localhost:8000 ./scripts/dev/api_test.sh GET /sentinel/templates

# Production (use with caution!)
API_BASE=https://core.digitalsanctum.com.au SANCTUM_PROFILE=prod ./scripts/dev/auth_test.sh
API_BASE=https://core.digitalsanctum.com.au SANCTUM_PROFILE=prod ./scripts/dev/api_test.sh GET /portal/dashboard
```

### Debugging API Issues
```bash
# 1. Enable verbose mode
VERBOSE=true ./scripts/dev/api_test.sh GET /problematic/endpoint

# 2. Check logs
cat ~/.sanctum/logs/request_*.log

# 3. Check token validity
cat ~/.sanctum/tokens/default.json
```

---

## Troubleshooting

### "No token found"
```bash
# Solution: Run auth_test.sh first
./scripts/dev/auth_test.sh
```

### "Authentication failed"
```bash
# Check credentials
# If 2FA is enabled, ensure TOTP code is correct

# For auto-TOTP, verify secret
echo $SANCTUM_TOTP_SECRET
```

### "Token expired"
```bash
# Re-authenticate
./scripts/dev/auth_test.sh

# Or delete old token
rm ~/.sanctum/tokens/default.txt
./scripts/dev/auth_test.sh
```

### "qrencode not found"
```bash
# macOS
brew install qrencode

# Linux
sudo apt install qrencode
```

### "oathtool not found"
```bash
# macOS
brew install oath-toolkit

# Linux
sudo apt install oathtool
```

---

## Future Enhancements

Planned utilities for `scripts/admin/`:
- `backup_db.sh` - Database backup automation
- `restore_db.sh` - Database restoration
- `reset_user_password.sh` - User password reset wrapper
- `seed_demo_data.sh` - Populate demo accounts/tickets
- `create_migration.sh` - Alembic migration helper

---

## Version History

- **v2.0** (2026-02-10)
  - Profile management for multi-user testing
  - Auto-TOTP code generation
  - Request logging and timing metrics
  - Token validation and reuse
  - QR code generation for mobile setup
  - Clipboard integration
  
- **v1.0** (Initial)
  - Basic authentication
  - Simple API testing
  - TOTP secret extraction

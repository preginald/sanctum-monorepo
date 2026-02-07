# Sanctum Utility Scripts

Operational and development utilities for Sanctum Core.

## Directory Structure
```
scripts/
├── dev/          # Development helpers
│   ├── auth_test.sh      # Login + test Sentinel API
│   └── api_test.sh       # Generic API tester
└── admin/        # Admin utilities (future: backups, migrations, etc.)
```

## Development Scripts

### auth_test.sh
Authenticates with the API, saves token, and tests Sentinel endpoints.

**Usage:**
```bash
# Interactive mode
./scripts/dev/auth_test.sh

# Non-interactive mode
./scripts/dev/auth_test.sh admin@example.com password123
```

**Output:**
- Saves token to `/tmp/sanctum_token.txt`
- Tests `/api/sentinel/templates`
- Verifies user profile

---

### api_test.sh
Generic API testing utility using saved token.

**Usage:**
```bash
# GET request
./scripts/dev/api_test.sh GET /sentinel/templates

# POST request
./scripts/dev/api_test.sh POST /tickets '{"subject":"Test Ticket","account_id":"..."}'

# PUT request
./scripts/dev/api_test.sh PUT /tickets/123 '{"status":"resolved"}'
```

**Examples:**
```bash
# List audit templates
./scripts/dev/api_test.sh GET /sentinel/templates

# Check system health
./scripts/dev/api_test.sh GET /system/health

# Get notifications
./scripts/dev/api_test.sh GET /notifications
```

---

## Environment Variables

- `API_BASE` - Base URL for API (default: `http://localhost:8000/api`)

**Example:**
```bash
export API_BASE="https://sanctum.example.com/api"
./scripts/dev/auth_test.sh
```

---

## Future Additions

Planned utilities for `scripts/admin/`:
- `backup_db.sh` - Database backup automation
- `restore_db.sh` - Database restoration
- `reset_user_password.sh` - User password reset wrapper
- `seed_demo_data.sh` - Populate demo accounts/tickets

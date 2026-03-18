#!/bin/bash
# Bootstrap script for Claude container sessions
# Usage: PAT="github_pat_..." bash scripts/bootstrap-container.sh
#
# Clones sanctum-monorepo, configures git, installs dependencies,
# and runs build checks for both frontend and backend.

set -e

REPO_DIR="/home/claude/sanctum-monorepo"
REPO_URL="https://${PAT}@github.com/preginald/sanctum-monorepo.git"

# Validate PAT
if [ -z "$PAT" ]; then
    echo "✗ PAT is required. Usage: PAT=\"github_pat_...\" bash $0"
    exit 1
fi

echo "── Bootstrap: sanctum-monorepo ──"

# Clone or pull
if [ -d "$REPO_DIR/.git" ]; then
    echo "→ Repo exists, pulling latest..."
    cd "$REPO_DIR"
    git pull --ff-only
else
    echo "→ Cloning repo..."
    git clone "$REPO_URL" "$REPO_DIR"
    cd "$REPO_DIR"
fi

# Configure git identity
git config user.name "Claude (Digital Sanctum)"
git config user.email "claude@digitalsanctum.com.au"
echo "✓ Git identity configured"

# Store PAT for push operations
git remote set-url origin "$REPO_URL"

# Frontend dependencies
echo "→ Installing frontend dependencies..."
cd "$REPO_DIR/sanctum-web"
npm install --silent 2>/dev/null
echo "✓ Frontend dependencies installed"

# Frontend build check
echo "→ Running frontend build..."
npm run build --silent 2>/dev/null
echo "✓ Frontend build OK"

# Backend dependencies
echo "→ Installing backend dependencies..."
cd "$REPO_DIR/sanctum-core"
pip install -r requirements.txt --break-system-packages -q 2>/dev/null
echo "✓ Backend dependencies installed"

# Summary
cd "$REPO_DIR"
BRANCH=$(git branch --show-current)
HEAD=$(git log --oneline -1)

echo ""
echo "========================================"
echo "✓ Bootstrap complete"
echo "========================================"
echo "  Branch: $BRANCH"
echo "  HEAD:   $HEAD"
echo "  Path:   $REPO_DIR"
echo ""
echo "  sanctum-web:  build OK"
echo "  sanctum-core: deps installed (no server — no DB)"
echo ""
echo "Ready to work. Create a feature branch with:"
echo "  git checkout -b feat/<ticket>-<description>"

#!/usr/bin/env bash
# Generates _variables.yml with the latest stable Publisher release version.
# Uses the GitHub API (via gh CLI) to fetch the latest non-pre-release version.
# Falls back to package.json when gh is unavailable (e.g., local development).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

VERSION=""
if command -v gh &> /dev/null; then
  VERSION=$(gh api repos/posit-dev/publisher/releases/latest --jq '.tag_name' 2>/dev/null | sed 's/^v//' || true)
fi

# Fallback to package.json if gh is not available or the API call failed
if [ -z "$VERSION" ]; then
  VERSION=$(node -p "require('$SCRIPT_DIR/../extensions/vscode/package.json').version")
fi

cat > "$SCRIPT_DIR/_variables.yml" <<EOF
version: "$VERSION"
EOF

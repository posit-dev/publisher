#!/usr/bin/env bash
# Generates _variables.yml with the current Publisher version from package.json
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION=$(node -p "require('$SCRIPT_DIR/../extensions/vscode/package.json').version")

cat > "$SCRIPT_DIR/_variables.yml" <<EOF
version: "$VERSION"
EOF

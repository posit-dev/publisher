#!/usr/bin/env bash
#
# Prepares a release by updating CHANGELOG files.
#
# Usage: ./scripts/prepare-release.bash <version>
#
# Example: ./scripts/prepare-release.bash 1.34.0
#
set -euo pipefail

if [ "${DEBUG:-false}" = true ]; then
    set -x
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

error() {
    echo -e "${RED}Error:${NC} $1" >&2
    exit 1
}

warn() {
    echo -e "${YELLOW}Warning:${NC} $1" >&2
}

info() {
    echo -e "${GREEN}✓${NC} $1"
}

# Check arguments
if [ $# -ne 1 ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 1.34.0"
    exit 1
fi

VERSION="$1"

# Remove 'v' prefix if present
VERSION="${VERSION#v}"

# Validate version format (x.y.z)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    error "Invalid version format: $VERSION (expected x.y.z)"
fi

# Extract minor version
MINOR=$(echo "$VERSION" | cut -d. -f2)

# Validate even minor version for production release
if [ $((MINOR % 2)) -ne 0 ]; then
    error "Production releases must have even minor version. Got: $VERSION (minor=$MINOR is odd)"
fi

info "Preparing release v$VERSION"

# Paths
ROOT_CHANGELOG="CHANGELOG.md"
VSCODE_CHANGELOG="extensions/vscode/CHANGELOG.md"

# Check files exist
[ -f "$ROOT_CHANGELOG" ] || error "Root CHANGELOG not found: $ROOT_CHANGELOG"
[ -f "$VSCODE_CHANGELOG" ] || error "VSCode CHANGELOG not found: $VSCODE_CHANGELOG"

# Extract content between [Unreleased] and next version header
# This captures everything after "## [Unreleased]" until the next "## [" line
UNRELEASED_CONTENT=$(awk '
    /^## \[Unreleased\]/ { capture=1; next }
    /^## \[/ && capture { exit }
    capture { print }
' "$ROOT_CHANGELOG")

# Check if there's any content to release
TRIMMED_CONTENT=$(echo "$UNRELEASED_CONTENT" | sed '/^[[:space:]]*$/d')
if [ -z "$TRIMMED_CONTENT" ]; then
    warn "No content found under [Unreleased] section"
    echo ""
    echo "The [Unreleased] section appears to be empty."
    echo "Make sure changelog entries have been added before releasing."
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Update root CHANGELOG.md
# Insert new version header after [Unreleased]
info "Updating $ROOT_CHANGELOG"

# Use awk to insert the new version section
awk -v version="$VERSION" '
    /^## \[Unreleased\]/ {
        print
        print ""
        print "## [" version "]"
        next
    }
    { print }
' "$ROOT_CHANGELOG" > "${ROOT_CHANGELOG}.tmp"

mv "${ROOT_CHANGELOG}.tmp" "$ROOT_CHANGELOG"

# Sync VSCode CHANGELOG from root (uses the justfile sync-changelog target)
# This regenerates the VSCode changelog from the root changelog, which now has the new version
info "Syncing $VSCODE_CHANGELOG from root"
just extensions/vscode/sync-changelog

info "Release v$VERSION prepared successfully!"
echo ""
echo "Updated files:"
echo "  - $ROOT_CHANGELOG"
echo "  - $VSCODE_CHANGELOG"
echo ""
echo "Next steps:"
echo "  1. Review the changes: git diff"
echo "  2. Commit: git add -A && git commit -m 'Release v$VERSION'"
echo "  3. Create PR or push to main"
echo "  4. Tag will be created automatically when release PR merges"

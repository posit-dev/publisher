#!/usr/bin/env bash
set -euo pipefail

# Generates a markdown-formatted Go coverage summary from a coverprofile.
# Usage: ./scripts/coverage-report.bash [cover.out]
# Output is written to stdout as GitHub-flavored Markdown.

COVER_FILE="${1:-cover.out}"

if [ ! -f "$COVER_FILE" ]; then
  echo "Error: coverage file '$COVER_FILE' not found." >&2
  echo "Run 'just test' first to generate it." >&2
  exit 1
fi

# Get the total coverage percentage from go tool cover
TOTAL=$(go tool cover -func="$COVER_FILE" | grep "^total:" | awk '{print $NF}')

echo "### Go Code Coverage"
echo ""
echo "**Total: ${TOTAL}**"
echo ""
echo "<details>"
echo "<summary>Coverage by package</summary>"
echo ""
echo "| Package | Coverage |"
echo "|---------|----------|"

# Extract per-package coverage (deduplicate by package, show last line per package which is the total)
go tool cover -func="$COVER_FILE" | \
  grep -v "^total:" | \
  awk -F'\t+' '{print $1, $NF}' | \
  sed 's|github.com/posit-dev/publisher/||' | \
  awk '{pkg=$1; sub(/:[^:]*$/, "", pkg); coverage=$NF; pkgs[pkg]=coverage} END {for (p in pkgs) print p, pkgs[p]}' | \
  sort | \
  awk '{printf "| %s | %s |\n", $1, $2}'

echo ""
echo "</details>"

#!/usr/bin/env bash
#
# Claude hook: PreToolUse gate for git commit commands.
# Inspects staged files and runs appropriate quality checks before allowing commits.
# Exit 0 = allow, Exit 2 = block with error message.

set -euo pipefail

# Read tool input JSON from stdin
INPUT=$(cat)

# Extract the bash command being run
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only gate git commit commands — let everything else through immediately
if ! echo "$COMMAND" | grep -qE '\bgit\s+commit\b'; then
  exit 0
fi

# Resolve project root (CLAUDE_PROJECT_DIR or fall back to git toplevel)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
VSCODE_DIR="$PROJECT_DIR/extensions/vscode"
WEBVIEW_DIR="$VSCODE_DIR/webviews/homeView"

# Get staged files
STAGED_FILES=$(git diff --cached --name-only 2>/dev/null || true)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

# Determine which check groups are needed
RUN_ESBUILD=false
RUN_LINT=false
RUN_TEST_UNIT=false
RUN_WEBVIEW_BUILD=false

while IFS= read -r file; do
  case "$file" in
    extensions/vscode/src/*|extensions/vscode/test/*)
      RUN_ESBUILD=true
      RUN_TEST_UNIT=true
      ;;
  esac
  case "$file" in
    extensions/vscode/*.ts|extensions/vscode/*.vue| \
    extensions/vscode/**/*.ts|extensions/vscode/**/*.vue)
      RUN_LINT=true
      ;;
  esac
  case "$file" in
    extensions/vscode/webviews/homeView/src/*)
      RUN_WEBVIEW_BUILD=true
      ;;
  esac
done <<< "$STAGED_FILES"

# Also match with grep for patterns that case statements handle poorly with deep paths
if echo "$STAGED_FILES" | grep -qE '^extensions/vscode/.*\.(ts|vue)$'; then
  RUN_LINT=true
fi
if echo "$STAGED_FILES" | grep -qE '^extensions/vscode/(src|test)/'; then
  RUN_ESBUILD=true
  RUN_TEST_UNIT=true
fi
if echo "$STAGED_FILES" | grep -qE '^extensions/vscode/webviews/homeView/src/'; then
  RUN_WEBVIEW_BUILD=true
fi

# Nothing to check
if ! $RUN_ESBUILD && ! $RUN_LINT && ! $RUN_TEST_UNIT && ! $RUN_WEBVIEW_BUILD; then
  exit 0
fi

# Check that dependencies are installed where needed
if ($RUN_ESBUILD || $RUN_LINT || $RUN_TEST_UNIT) && [ ! -d "$VSCODE_DIR/node_modules" ]; then
  echo "Dependencies not installed. Run 'npm install' in extensions/vscode/ first." >&2
  exit 2
fi
if $RUN_WEBVIEW_BUILD && [ ! -d "$WEBVIEW_DIR/node_modules" ]; then
  echo "Dependencies not installed. Run 'npm install' in extensions/vscode/webviews/homeView/ first." >&2
  exit 2
fi

FAILED=false

run_check() {
  local label="$1"
  local dir="$2"
  shift 2
  echo "Running $label..." >&2
  if ! (cd "$dir" && "$@") 2>&1; then
    echo "FAILED: $label" >&2
    FAILED=true
  fi
}

if $RUN_ESBUILD; then
  run_check "esbuild-base (tsc + esbuild)" "$VSCODE_DIR" npm run esbuild-base
fi

if $RUN_LINT; then
  run_check "lint (eslint)" "$VSCODE_DIR" npm run lint
fi

if $RUN_TEST_UNIT; then
  run_check "test-unit (vitest)" "$VSCODE_DIR" npm run test-unit
fi

if $RUN_WEBVIEW_BUILD; then
  run_check "webview build (vue-tsc + vite)" "$WEBVIEW_DIR" npm run build
fi

if $FAILED; then
  echo "" >&2
  echo "Pre-commit checks failed. Fix the errors above before committing." >&2
  exit 2
fi

exit 0

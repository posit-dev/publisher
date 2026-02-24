#!/usr/bin/env bash
set -euo pipefail

# Check if publisher extension is installed in workbench-release
# This command is designed to work from any directory (Cypress or command line)

# Determine the expected installed version
# The build process (set-version.py) only updates package.json for exact semver versions (X.Y.Z).
# For non-release versions (e.g., 1.31.7-7-gabcdef), it leaves package.json at 99.0.0.
# We need to match this logic to know what version the extension will actually install as.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR/../.."

# Get the git-derived version (same as build process)
GIT_VERSION=$(cd "$REPO_ROOT" && git describe --tags 2>/dev/null | sed 's/^v//')

if [ -z "$GIT_VERSION" ]; then
    echo "Warning: Could not determine version from git tags, falling back to 99.0.0"
    EXPECTED_VERSION="99.0.0"
elif [[ "$GIT_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    # Exact semver version (e.g., 1.32.0) - set-version.py will update package.json
    EXPECTED_VERSION="$GIT_VERSION"
else
    # Non-release version (e.g., 1.31.7-7-gabcdef) - set-version.py skips, stays at 99.0.0
    EXPECTED_VERSION="99.0.0"
fi

echo "Git version: $GIT_VERSION, Expected installed version: $EXPECTED_VERSION"
mkdir -p ./logs/workbench-extension
INSTALL_LOG="./logs/workbench-extension/workbench-extension-check.log"

echo "Checking for publisher extension..." | tee "$INSTALL_LOG"
docker ps | tee -a "$INSTALL_LOG"

if ! docker ps | grep "workbench" | grep -q "release"; then
    echo "Container with 'workbench' and 'release' in name is not running" | tee -a "$INSTALL_LOG"
    exit 1
fi

EXTENSION_FOUND=$(docker exec -u rstudio publisher-e2e.workbench-release bash -c "find /home/rstudio/.positron-server/extensions -path '*publisher*' -name package.json" 2>/dev/null | grep -c package.json || echo "0")

echo "Available extension directories:" | tee -a "$INSTALL_LOG"
docker exec -u rstudio publisher-e2e.workbench-release bash -c "find /home/rstudio/.positron-server/extensions -type d -maxdepth 2" | tee -a "$INSTALL_LOG" || echo "No extensions directory found" | tee -a "$INSTALL_LOG"

if [ "$EXTENSION_FOUND" -gt "0" ]; then
    echo "Publisher extension is installed, checking version..." | tee -a "$INSTALL_LOG"

    EXPECTED_VERSION_DIR=$(docker exec -u rstudio publisher-e2e.workbench-release bash -c "find /home/rstudio/.positron-server/extensions -name 'posit.publisher-$EXPECTED_VERSION' -type d" 2>/dev/null || echo "")

    echo "Checking for version directory: posit.publisher-$EXPECTED_VERSION" | tee -a "$INSTALL_LOG"

    if [ -n "$EXPECTED_VERSION_DIR" ]; then
        echo "✅ Correct Publisher extension version $EXPECTED_VERSION is installed" | tee -a "$INSTALL_LOG"
        echo "Found at: $EXPECTED_VERSION_DIR" | tee -a "$INSTALL_LOG"
        exit 0
    else
        echo "❌ Expected Publisher extension version $EXPECTED_VERSION not found" | tee -a "$INSTALL_LOG"
        echo "Available Publisher versions:" | tee -a "$INSTALL_LOG"
        docker exec -u rstudio publisher-e2e.workbench-release bash -c "find /home/rstudio/.positron-server/extensions -name 'posit.publisher-*' -type d" | tee -a "$INSTALL_LOG" || echo "No Publisher versions found" | tee -a "$INSTALL_LOG"
        exit 1
    fi
else
    echo "❌ Publisher extension is NOT installed" | tee -a "$INSTALL_LOG"
    exit 1
fi

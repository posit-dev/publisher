#!/usr/bin/env bash
set -euo pipefail

# Check if publisher extension is installed in workbench-release
# This command is designed to work from any directory (Cypress or command line)

# Set expected version
EXPECTED_VERSION="99.0.0"
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

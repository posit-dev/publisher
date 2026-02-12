#!/usr/bin/env bash
set -euo pipefail

# Install Publisher extension in a running Workbench container
# Usage: install-workbench-extension.sh <service>

SERVICE="${1:-release}"

# Read expected version from package.json, with fallback
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_JSON="$SCRIPT_DIR/../../extensions/vscode/package.json"

if [ -f "$PACKAGE_JSON" ]; then
    EXPECTED_VERSION=$(grep -o '"version": *"[^"]*"' "$PACKAGE_JSON" | cut -d'"' -f4)
else
    echo "Warning: package.json not found at $PACKAGE_JSON, falling back to hardcoded version"
    EXPECTED_VERSION="99.0.0"
fi

echo "Installing Publisher extension in Workbench $SERVICE container..."

# Check if container is running
if ! docker ps | grep "publisher-e2e.workbench-$SERVICE" | grep -q "Up"; then
    echo "Container publisher-e2e.workbench-$SERVICE is not running."
    echo "Please start it first with: just start-workbench $SERVICE"
    exit 1
fi

# Find the VSIX file directly from the mounted volume
echo "Looking for VSIX file in container..."
VSIX_FILENAME=$(docker exec publisher-e2e.workbench-$SERVICE bash -c "ls -Art /vsix-tmp | grep linux-amd64 | tail -n 1")

if [ -z "$VSIX_FILENAME" ]; then
    echo "ERROR: No linux-amd64 Publisher VSIX found in container."
    echo "Contents of /vsix-tmp:"
    docker exec publisher-e2e.workbench-$SERVICE bash -c "ls -la /vsix-tmp"
    exit 1
fi

echo "Using VSIX: $VSIX_FILENAME"

# Set proper ownership for the VSIX directory and files
docker exec publisher-e2e.workbench-$SERVICE bash -c "chown -R rstudio:rstudio /vsix-tmp" || {
    echo "ERROR: Failed to set ownership on /vsix-tmp"
    exit 1
}

# Create the .positron-server directory with proper permissions
echo "Creating .positron-server directory with proper permissions..."
docker exec publisher-e2e.workbench-$SERVICE bash -c "mkdir -p /home/rstudio/.positron-server && chown -R rstudio:rstudio /home/rstudio/.positron-server"

# Create logs directory with workbench prefix
mkdir -p ./logs/workbench-extension
INSTALL_LOG="./logs/workbench-extension/workbench-extension-installation.log"

# Run installation command as the rstudio user to ensure proper permissions
echo "Running installation command..." | tee "$INSTALL_LOG"
docker exec -u rstudio publisher-e2e.workbench-$SERVICE bash -c "cd /usr/lib/rstudio-server/bin/positron-server && ./bin/positron-server --install-extension /vsix-tmp/$VSIX_FILENAME --force" | tee -a "$INSTALL_LOG" || {
    echo "Installation command failed" | tee -a "$INSTALL_LOG"
    exit 2
}

# Verify the extension is installed
echo "Verifying installation..." | tee -a "$INSTALL_LOG"

MAX_ATTEMPTS=5

for i in $(seq 1 $MAX_ATTEMPTS); do
    echo "Verification attempt $i/$MAX_ATTEMPTS..." | tee -a "$INSTALL_LOG"

    # Check specifically for expected version
    EXPECTED_DIR=$(docker exec -u rstudio publisher-e2e.workbench-$SERVICE bash -c "find /home/rstudio/.positron-server/extensions -name 'posit.publisher-$EXPECTED_VERSION' -type d" 2>/dev/null || echo "")

    if [ -n "$EXPECTED_DIR" ]; then
        echo "✅ Publisher extension version $EXPECTED_VERSION successfully installed!" | tee -a "$INSTALL_LOG"
        echo "Found at: $EXPECTED_DIR" | tee -a "$INSTALL_LOG"
        exit 0
    fi

    # If we reach the last attempt, show error and exit
    if [ $i -eq $MAX_ATTEMPTS ]; then
        echo "ERROR: Failed to verify extension installation with version $EXPECTED_VERSION" | tee -a "$INSTALL_LOG"
        echo "Available Publisher versions:" | tee -a "$INSTALL_LOG"
        docker exec -u rstudio publisher-e2e.workbench-$SERVICE bash -c "find /home/rstudio/.positron-server/extensions -name 'posit.publisher-*' -type d" | tee -a "$INSTALL_LOG" || echo "No Publisher versions found" | tee -a "$INSTALL_LOG"
        exit 1
    fi

    echo "Version $EXPECTED_VERSION not found yet, waiting..." | tee -a "$INSTALL_LOG"
    sleep 2
done

# This should not be reached due to the exit statements above
echo "ERROR: Unexpected end of verification loop" | tee -a "$INSTALL_LOG"
exit 1

#!/usr/bin/env bash
set -e

# Extract Positron logs from Workbench container
# Usage: extract-positron-logs.sh <service>

SERVICE="${1:-release}"

# Check if container is running
if ! docker ps | grep "publisher-e2e.workbench-$SERVICE" | grep -q "Up"; then
    echo "Container publisher-e2e.workbench-$SERVICE is not running, skipping log extraction"
    exit 0
fi

# Create logs directory
mkdir -p ./logs/positron-$SERVICE

# Extract logs from container
if docker cp publisher-e2e.workbench-$SERVICE:/home/rstudio/.local/state/positron/logs/. ./logs/positron-$SERVICE/ 2>/dev/null; then
    echo "✅ Positron logs extracted to ./logs/positron-$SERVICE/"
else
    echo "No Positron logs found in container"
fi

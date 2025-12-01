#!/usr/bin/env bash
set -euo pipefail

# Start a Workbench container
# Usage: start-workbench.sh <service>

SERVICE="${1:-release}"

# Create directories for volumes if they do not exist
mkdir -p ./logs/workbench-$SERVICE
mkdir -p ./licenses

# Check if license file exists and is valid (not just a placeholder)
if [ ! -s ./licenses/workbench-license.lic ] || [ "$(cat ./licenses/workbench-license.lic | wc -l)" -lt 2 ]; then
    echo "WARNING: Valid Workbench license file not found at ./licenses/workbench-license.lic"
    echo "You must have a valid Workbench license file to use the containers without license errors."
    echo "Please add a valid license file before starting the container."
    echo ""
fi

echo "Starting Workbench $SERVICE container..."
docker compose up -d workbench-$SERVICE

echo "Waiting for container to become healthy..."
# Docker compose has built-in healthcheck support

# Simple approach: Loop with a counter, no external tools needed
MAX_ATTEMPTS=180  # 90 seconds (180 * 0.5s)
attempts=0

while [ $attempts -lt $MAX_ATTEMPTS ]; do
    if docker compose ps | grep "workbench-$SERVICE" | grep -q "healthy"; then
        echo ""
        echo "✅ Workbench $SERVICE is healthy and ready!"
        break
    fi
    echo -n "."
    sleep 0.5
    attempts=$((attempts + 1))
done

# Check if we timed out
if [ $attempts -eq $MAX_ATTEMPTS ]; then
    echo ""
    echo "⚠️ Timed out waiting for container to become healthy"
    echo "Check container logs with: docker logs publisher-e2e.workbench-$SERVICE"
fi
echo ""

echo "Access Workbench at: http://localhost:8787"

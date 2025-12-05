#!/usr/bin/env bash
#
# This script removes some files from the GitHub Actions runners. Use for
# steps which use a significant amount of local storage.
#
# Do not use this script across all steps, as this removal can take between
# 1-10m to complete depending on the folders selected.
#
# Configuration:
# - TIDY_FOLDERS: Space-separated list of folders to remove. If not set,
#   uses a default list of common large folders on GitHub Actions runners.
#
# Usage examples:
#
# Default usage (removes predefined set of folders):
# jobs:
#   JOB_NAME:
#     steps:
#       - name: Tidy CI environment
#         run: ./tools/dev/tidy-github-actions-runner.sh
#
# Custom folder list:
# jobs:
#   JOB_NAME:
#     steps:
#       - name: Tidy CI environment
#         env:
#           TIDY_FOLDERS: "/opt/hostedtoolcache/CodeQL /usr/lib/jvm /usr/local/share/chromium"
#         run: ./tools/dev/tidy-github-actions-runner.sh

# Function to get disk usage in human readable format
get_disk_usage() {
    df -h / | awk 'NR==2 {print "Used: " $3 "/" $2 " (" $5 " full)"}'
}

elapsed_time() {
    local start_time=$1
    echo $((end_time - start_time))
}

# Function to time and instrument directory removal
timed_removal() {
    local dir=$1
    
    echo "=== Removing $dir ==="
    echo "Before removal:"
    get_disk_usage
    
    if [ -d "$dir" ]; then
        start_time=$(date +%s)
        sudo rm -rf "$dir"
        end_time=$(date +%s)
        
        duration=$((end_time - start_time))
        echo "Removal took: ${duration}s"
    else
        echo "Directory $dir does not exist, skipping"
    fi
    
    echo "After removal:"
    get_disk_usage

    elapsed_time=$(($(date +%s) - OVERALL_START_TIME))
    echo "Running for: ${elapsed_time}s"
    echo ""
}

# Default folders to remove if TIDY_FOLDERS is not set
# Sorted by typical size on GitHub-hosted runners, largest first
DEFAULT_FOLDERS="/usr/local/.ghcup /usr/share/swift /opt/hostedtoolcache/CodeQL /usr/local/share/powershell /usr/lib/jvm /usr/local/julia* /usr/local/share/chromium"

# Use TIDY_FOLDERS environment variable if set, ot`herwise use defaults
FOLDERS_TO_REMOVE=${TIDY_FOLDERS:-$DEFAULT_FOLDERS}

echo "=== Folders to remove ==="
echo "$FOLDERS_TO_REMOVE"
echo ""

OVERALL_START_TIME=$(date +%s)

# Remove each folder in the list
for folder in $FOLDERS_TO_REMOVE; do
    timed_removal "$folder"
done

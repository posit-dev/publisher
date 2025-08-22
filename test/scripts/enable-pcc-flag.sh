#!/bin/sh
set -eu

SETTINGS_FILE="/home/coder/workspace/.vscode/settings.json"
mkdir -p /home/coder/workspace/.vscode

if [ -f "$SETTINGS_FILE" ]; then
  jq '. + {"positPublisher.enableConnectCloud": true}' "$SETTINGS_FILE" > "$SETTINGS_FILE.tmp" && mv "$SETTINGS_FILE.tmp" "$SETTINGS_FILE"
else
  echo '{ "positPublisher.enableConnectCloud": true }' > "$SETTINGS_FILE"
fi

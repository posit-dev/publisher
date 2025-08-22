#!/bin/sh
set -xeu

# Get the latest linux-amd64 build
VSIX_FILENAME=$(ls -Art /home/coder/vsix | grep linux-amd64 | tail -n 1)

# Custom vscode User settings, avoid setup wizards
# echo > /home/coder/.local/share/code-server/User/settings.json
mkdir -p /home/coder/.local/share/code-server/User
cat <<EOF > /home/coder/.local/share/code-server/User/settings.json

{
  "remote.autoForwardPortsSource": "hybrid",
  "workbench.settings.applyToAllProfiles": [],
  "workbench.startupEditor": "none",
  "window.restoreWindows": "none",
  "files.hotExit": "off",
  "positPublisher.useKeyChainCredentialStorage": false
}

EOF

# Ensure the workspace settings enable Connect Cloud, preserving other settings
/usr/local/bin/enable-pcc-flag.sh

# Code server entrypoint that starts the service
exec /usr/bin/code-server --disable-workspace-trust --auth none --bind-addr 0.0.0.0:8080 .
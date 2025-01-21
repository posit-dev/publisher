#!/bin/sh
set -eu

# Get the latest linux-amd64 build
VSIX_FILENAME=$(ls -Art /home/coder/vsix | grep linux-amd64 | tail -n 1)

# Install the Publisher extension
code-server --install-extension "/home/coder/vsix/${VSIX_FILENAME}"

# Custom vscode User settings, avoid setup wizards
# echo > /home/coder/.local/share/code-server/User/settings.json
cat <<EOF > /home/coder/.local/share/code-server/User/settings.json

{
  "remote.autoForwardPortsSource": "hybrid",
  "workbench.settings.applyToAllProfiles": [],
  "workbench.startupEditor": "none",
  "window.restoreWindows": "none",
  "files.hotExit": "off"
}

EOF

# Run the original code server entrypoint that starts the service
/usr/bin/entrypoint.sh --disable-workspace-trust --auth none --bind-addr 0.0.0.0:8080 .
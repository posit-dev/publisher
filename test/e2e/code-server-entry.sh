#!/bin/sh
set -xeu

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

if [ "${CI:-}" = "true" ]; then
  # In CI: Start code-server immediately, install extension later via API
  exec /usr/bin/code-server --disable-workspace-trust --auth none --bind-addr 0.0.0.0:8080 .
else
  # Local: Install extension first, then start server (original behavior)
  VSIX_FILENAME=$(ls -Art /home/coder/vsix | grep linux-amd64 | tail -n 1 || true)
  if [ -n "$VSIX_FILENAME" ]; then
    code-server --install-extension "/home/coder/vsix/${VSIX_FILENAME}" || exit 1
  fi
  exec /usr/bin/code-server --disable-workspace-trust --auth none --bind-addr 0.0.0.0:8080 .
fi

#!/bin/bash
set -e

echo "Initializing Posit Workbench container with customized settings..."

echo "Configuring Positron settings..."

# Create the settings file with workspace trusting disabled and other settings
cat > /etc/rstudio/positron-user-settings.json << EOF
{
  "security.workspace.trust.enabled": false,
  "security.workspace.trust.banner": "never",
  "security.workspace.trust.startupPrompt": "never",
  "extensions.autoUpdate": false,
  "extensions.autoCheckUpdates": false,
  "update.showReleaseNotes": false,
  "update.mode": "none",
  "telemetry.telemetryLevel": "off"
}
EOF

echo "Global Positron settings configured successfully."

# Add to the beginning of workbench-entrypoint.sh (before starting the service)
echo "Setting permissions to make content-workspace and immediate subdirectories writable for all users"
chmod 777 /content-workspace
find /content-workspace -maxdepth 1 -type d -exec chmod 777 {} \;

# Start Posit Workbench using supervisord (the default command for the image)
echo "Starting Posit Workbench..."
exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf

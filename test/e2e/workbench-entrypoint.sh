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
# Set ownership to rstudio user (UID 10000, created by supervisord)
# Using UID because user doesn't exist yet at entrypoint time
echo "Setting ownership of content-workspace to rstudio user (UID 10000)"
chown -R 10000:10000 /content-workspace

# Start Posit Workbench using supervisord (the default command for the image)
echo "Starting Posit Workbench..."
exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf

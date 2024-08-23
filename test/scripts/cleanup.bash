#!/usr/bin/env bash
set -euo pipefail

CREDS_GUID="$(${EXE} credentials list | jq -r '.[] | select(.name == "my connect server") | .guid')"
${EXE} credentials delete ${CREDS_GUID}

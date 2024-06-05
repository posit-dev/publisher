#!/usr/bin/env bash
set -euo pipefail
if [ "${DEBUG:-false}" = true ];
then
  set -x
fi

minor_version=$(./scripts/get-version.bash | cut -d '.' -f 2)

if [[ $minor_version = *[13579] ]]; then
    # odd minor versions are pre-releases
    echo true
else
    # even minor versions are production releases
    echo false
fi

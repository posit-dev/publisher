#!/usr/bin/env bash
set -euo pipefail
if [ "${DEBUG:-false}" = true ];
then
  set -x
fi

version=$(git describe --tags)
echo "${version/v/}"

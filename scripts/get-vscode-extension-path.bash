#!/usr/bin/env bash
set -euo pipefail
if [ "${DEBUG:-false}" = true ];
then
  set -x
fi

if [ "$#" -ne 2 ]; then
    echo "usage: $0 <cmd> <version>"
    exit 1
fi

cmd=$1
version=$2

name=$(basename "$cmd")

printf "$(pwd)/packages/%s" "$name-$version.vsix"

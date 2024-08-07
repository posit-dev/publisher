#!/usr/bin/env bash
set -euo pipefail
if [ "${DEBUG:-false}" = true ];
then
  set -x
fi

if [ "$#" -ne 4 ]; then
    echo "usage: $0 <cmd> <version> <os> <arch>"
    exit 1
fi

cmd=$1
version=$2
os=$3
arch=$4

name=$(basename "$cmd")

if [ "$os" = "windows" ]; then
    printf "$(pwd)/bin/%s/%s/%s/%s" "$os" "$arch" "$version" "$name.exe"
else
    printf "$(pwd)/bin/%s/%s/%s/%s" "$os" "$arch" "$version" "$name"
fi

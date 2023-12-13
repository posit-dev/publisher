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
    printf "$(pwd)/archives/%s" "$name-$version-$os-$arch.zip"
else
    printf "$(pwd)/archives/%s" "$name-$version-$os-$arch.tar.gz"
fi

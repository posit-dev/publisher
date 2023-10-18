#!/usr/bin/env bash
set -euo pipefail

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
    printf "$(pwd)/bin/%s/%s/%s" "$os" "$arch" "$name-$version-$os-$arch.exe"
else
    printf "$(pwd)/bin/%s/%s/%s" "$os" "$arch" "$name-$version-$os-$arch"
fi

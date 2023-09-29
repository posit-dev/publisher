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

extension=""
if [ "$os" = "windows" ]; then
    extension+='.exe'
fi

echo "./bin/$os/$arch/$name-$version-$os-$arch$extension"

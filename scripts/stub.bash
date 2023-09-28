#!/usr/bin/env bash
set -euo pipefail

dir=web/dist

if [ ! -d "$dir" ]; then
  mkdir -p $dir
  touch $dir/generated.txt
  echo "This file was created by ./scripts/stub.bash" >> $dir/generated.txt
fi

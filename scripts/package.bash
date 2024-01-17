#!/usr/bin/env bash
set -euo pipefail
if [ "${DEBUG:-false}" = true ];
then
  set -x
fi

CI="${CI:-false}"

cmd=$1
if [[ -z "$cmd" ]]; then
  echo "usage: $0 <cmd>"
  exit 1
fi
echo "Command: $cmd" 1>&2

version=$(./scripts/get-version.bash)
echo "Version: $version" 1>&2

name=$(basename "$cmd")
echo "Name: $name" 1>&2

platforms=()
while IFS='' read -r line; do platforms+=("$line"); done < <(./scripts/get-platforms.bash)
for platform in "${platforms[@]}"
do
    echo "Packaging: $platform" 1>&2
    os=${platform/\/*}   # retain the part before the slash
    arch=${platform/*\/} # retain the part after the slash
    just vscode default "$os" "$arch"
done

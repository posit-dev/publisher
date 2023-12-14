#!/usr/bin/env bash
set -euo pipefail
if [ "${DEBUG:-false}" = true ];
then
  set -x
fi

REF=${GITHUB_REF:

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
    echo "Releasing: $platform" 1>&2
    os=${platform/\/*}   # retain the part before the slash
    arch=${platform/*\/} # retain the part after the slash

    archive=$(./scripts/get-archive-path.bash "$name" "$version" "$os" "$arch" )
    echo $archive


done

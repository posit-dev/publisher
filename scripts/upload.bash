#!/usr/bin/env bash
set -euo pipefail
if [ "${DEBUG:-false}" = true ];
then
  set -x
fi

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

ref="${GITHUB_REF}"
echo "Git Reference: $ref" 1>&2
ref=${ref#"refs/"}

object_path="s3://posit-publisher/$name/releases/$ref"
echo "Object Path: $object_path" 1>&2

platforms=()
while IFS='' read -r line; do platforms+=("$line"); done < <(./scripts/get-platforms.bash)
for platform in "${platforms[@]}"
do
    echo
    echo "Release: $platform" 1>&2
    os=${platform/\/*}   # retain the part before the slash
    arch=${platform/*\/} # retain the part after the slash
    archive=$(./scripts/get-archive-path.bash "$name" "$version" "$os" "$arch" )
    echo "Archive: $archive" 1>&2
    if ! [ -f "$archive" ];
    then
      echo "Not Found. Skipping..." 1>&2
    else
      object="$object_path/$(basename "$archive")"
      echo "Object: $object" 1>&2
      aws s3 cp "$archive" "$object" > /dev/null 2>&1
    fi
done

extension=$(./scripts/get-vscode-extension-path.bash "$name" "$version")
echo
echo "VSCode Extension: $extension"
if ! [ -f "$extension" ];
then
  echo "Not Found. Skipping..." 1>&2
else
  object="$object_path/$(basename "$extension")"
  echo "Object: $object" 1>&2
  aws s3 cp "$extension" "$object" > /dev/null 2>&1
fi

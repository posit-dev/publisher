#!/usr/bin/env bash
set -euo pipefail
if [ "${DEBUG:-false}" = true ];
then
  set -x
fi

cmd=${1-}
if [ -z "$cmd" ]; then
  echo "usage: $0 <cmd>"
  exit 1
fi
echo "Command: $cmd" 1>&2

release_type=${2-commit}
case $release_type in
  commit|nightly)
    echo "Release type: $release_type" 1>&2 ;;
  *) 
    echo "usage: $0 <cmd> [commit(default)|nightly]"
    exit 1 ;;
esac

version=$(./scripts/get-version.bash)
echo "Version: $version" 1>&2

name=$(basename "$cmd")
echo "Name: $name" 1>&2

ref="${GITHUB_REF:-$(git show-ref --heads "$(git rev-parse --abbrev-ref HEAD)" | awk '{print $2}')}"
echo "Git Reference: $ref" 1>&2
ref=${ref#"refs/"}

if [ $release_type == "nightly" ]; then
  object_path="s3://posit-publisher/$name/releases/nightly"
else 
  # This is effectively release_type == "nightly"
  object_path="s3://posit-publisher/$name/releases/$ref"
fi  
echo "Object Path: $object_path" 1>&2

today=$(date -I)
echo "Today's date: $today" 1>&2

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
      if [ $release_type == "nightly" ]; 
      then
        object="$object_path/v$today/$(basename $(./scripts/get-archive-path.bash "$name" "$today" "$os" "$arch" ))"
      else
        object="$object_path/$(basename "$archive")"
      fi 
      echo "Object: $object" 1>&2
      aws s3 cp "$archive" "$object" > /dev/null 2>&1
    fi

    extension=$(./scripts/get-vscode-extension-path.bash "$name" "$version" "$os" "$arch")
    echo "VSCode Extension: $extension"
    if ! [ -f "$extension" ];
    then
      echo "Not Found. Skipping..." 1>&2
    else
      if [ $release_type == "nightly" ]; 
      then
        object="$object_path/v$$today/$(basename $(./scripts/get-vscode-extension-path.bash "$name" "$today" "$os" "$arch"))"
      else
        object="$object_path/$(basename "$extension")"
      fi 
      echo "Object: $object" 1>&2
      aws s3 cp "$extension" "$object" > /dev/null 2>&1
    fi
done

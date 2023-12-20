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
    echo "Archiving: $platform" 1>&2
    os=${platform/\/*}   # retain the part before the slash
    arch=${platform/*\/} # retain the part after the slash

    executable=$(./scripts/get-executable-path.bash "$name" "$version" "$os" "$arch" )
    if [ ! -f "$executable" ]; then
        echo "error: Missing executable $executable. Run \`just build\`." 1>&2
        exit 1
    fi

    archive=$(./scripts/get-archive-path.bash "$name" "$version" "$os" "$arch" )
    dir=$(mktemp -d)
    mkdir -p "${dir}"/"${name}"/bin
    cp "${executable}" "${dir}"/"${name}"/bin
    mkdir -p "$(dirname "$archive")"

    if [ "${os}" = "windows" ];
    then
    (
      cd "$dir"
      zip -r "$archive" . &>/dev/null
    )
    else
      tar -a -cf "$archive" -C "${dir}" .
    fi

    echo "Archive: $archive" 1>&2
done

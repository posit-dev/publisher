#!/usr/bin/env bash
set -euo pipefail

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

platforms=("$(go env GOHOSTOS)/$(go env GOHOSTARCH)")
if [ "$CI" = "true" ]; then
    platforms=(
        "darwin/amd64"
        "darwin/arm64"
        # "dragonfly/amd64"
        # "freebsd/386"
        # "freebsd/amd64"
        # "freebsd/arm"
        # "linux/386"
        "linux/amd64"
        # "linux/arm"
        "linux/arm64"
        # "linux/ppc64"
        # "linux/ppc64le"
        # "linux/mips"
        # "linux/mipsle"
        # "linux/mips64"
        # "linux/mips64le"
        # "netbsd/386"
        # "netbsd/amd64"
        # "netbsd/arm"
        # "openbsd/386"
        # "openbsd/amd64"
        # "openbsd/arm"
        # "plan9/386"
        # "plan9/amd64"
        # "solaris/amd64"
        # "windows/386"
        "windows/amd64"
    )
fi

for platform in "${platforms[@]}"
do
    echo "Archiving: $platform" 1>&2
    os=${platform/\/*}   # retain the part before the slash
    arch=${platform/*\/} # retain the part after the slash

    executable=$(./scripts/get-executable-path.bash "$name" "$version" "$os" "$arch" )
    if [ ! -f "$executable" ]; then
        echo "error: Missing executable. Run \`just build\`." 1>&2
        exit 1
    fi

    archive=$(./scripts/get-archive-path.bash "$name" "$version" "$os" "$arch" )
    dir=$(mktemp -d)
    mkdir -p "${dir}"/"${name}"/bin
    cp "${executable}" "${dir}"/"${name}"/bin
    mkdir -p "$(dirname "$archive")"
    tar -a -cf "$archive" -C "${dir}" .

    echo "Archive: $archive" 1>&2
done

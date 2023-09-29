#!/usr/bin/env bash
set -euo pipefail

if [ ! -d "./web/dist" ]; then
    echo "error: Missing frontend distribution. Run \`just web build\` or \`just stub\`." 1>&2
    exit 1
fi

CI="${CI:-false}"

cmd=$1
if [[ -z "$cmd" ]]; then
  echo "usage: $0 <cmd>"
  exit 1
fi
echo "Package: $cmd"

version=$(./scripts/get-version.bash)
echo "Version: $version"

name=$(basename "$cmd")
echo "Name: $name"

mode=${MODE:-"dev"}
echo "Mode: $mode"

platforms=("$(go env GOOS)/$(go env GOARCH)")
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
    echo "Building: $platform"
    os=${platform/\/*}   # retain the part before the slash
    arch=${platform/*\/} # retain the part after the slash

    executable=$(./scripts/get-executable-path.bash "$name" "$version" "$os" "$arch" )

    env\
        GOOS="$os"\
        GOARCH="$arch"\
        go build\
        -o "$executable"\
        -ldflags "-X 'github.com/rstudio/connect-client/internal/project.Version=$version' -X 'github.com/rstudio/connect-client/internal/project.Mode=$mode'"\
        "$cmd"

    echo "Executable: $executable"
    chmod +x "$executable"
done

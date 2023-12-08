#!/usr/bin/env bash
set -euo pipefail

if [ ! -d "./web/dist" ]; then
    echo "error: Missing frontend distribution. Run \`just web build\` or \`just stub\`." 1>&2
    exit 1
fi

CI="${CI:-false}"

cmd=$1
if [[ -z "$cmd" ]]; then
  echo "usage: $0 <cmd>" 1>&2
  exit 1
fi
echo "Command: $cmd" 1>&2

version=$(./scripts/get-version.bash)
echo "Version: $version" 1>&2

name=$(basename "$cmd")
echo "Name: $name" 1>&2

mode=${MODE:-"dev"}
echo "Mode: $mode" 1>&2

platforms=()
while IFS='' read -r line; do platforms+=("$line"); done < <(./scripts/get-platforms.bash)
for platform in "${platforms[@]}"
do
    echo "Building: $platform" 1>&2
    os=${platform/\/*}   # retain the part before the slash
    arch=${platform/*\/} # retain the part after the slash

    executable=$(./scripts/get-executable-path.bash "$name" "$version" "$os" "$arch" )

    env\
        CGO_ENABLED=0\
        GOOS="$os"\
        GOARCH="$arch"\
        go build\
        -o "$executable"\
        -ldflags "-X 'github.com/rstudio/connect-client/internal/project.Version=$version' -X 'github.com/rstudio/connect-client/internal/project.Mode=$mode'"\
        "$cmd"

    chmod +x "$executable"
    echo "Executable: $executable" 1>&2
done

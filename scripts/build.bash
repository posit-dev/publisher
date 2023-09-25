#!/usr/bin/env bash

set -e

package=$1
version=$2
if [[ -z "$package" || -z "$version" ]]; then
  echo "usage: $0 <package-name> <version>"
  exit 1
fi
echo "Package: $package"
echo "Version: $version"

name=$(basename "$package")
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
	platform_split=(${platform//\// })
	GOOS=${platform_split[0]}
	GOARCH=${platform_split[1]}

    executable=./bin/$GOOS-$GOARCH/$name-$version
	if [ "$GOOS" = "windows" ]; then
		executable+='.exe'
    else
        executable+='.bin'
	fi

    if [ ! -d "./web/dist" ]; then
        echo "Error: Missing frontend distribution. Run just web/build." 1>&2
        exit 1
    fi

    env\
        GOOS="$GOOS"\
        GOARCH="$GOARCH"\
        go build\
        -o "$executable"\
        -ldflags "-X 'github.com/rstudio/connect-client/internal/project.Version=$version' -X 'github.com/rstudio/connect-client/internal/project.Mode=$mode'"\
        "$package"

    echo "Executable: $executable"
    chmod +x "$executable"
done

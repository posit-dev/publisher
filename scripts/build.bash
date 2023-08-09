#!/usr/bin/env bash

set -eo pipefail

package=$1
if [[ -z "$package" ]]; then
  echo "usage: $0 <package-name>"
  exit 1
fi

package_name=$(basename "$package")
platforms=("$(go env GOOS)/$(go env GOARCH)")
version=$(git describe --always --tags)
developmentMode=${BUILD_MODE:-"production"}

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
    echo "Building $platform"
	platform_split=(${platform//\// })
	GOOS=${platform_split[0]}
	GOARCH=${platform_split[1]}
	output_name='./bin/'$GOOS'-'$GOARCH/$package_name
	if [ "$GOOS" = "windows" ]; then
		output_name+='.exe'
	fi

    env GOOS="$GOOS" GOARCH="$GOARCH" go build -o "$output_name" -ldflags \
        "-X 'github.com/rstudio/connect-client/internal/project.Version=$version' -X 'github.com/rstudio/connect-client/internal/project.Mode=$developmentMode'" \
        "$package"
	if [ $? -ne 0 ]; then
   		echo 'An error has occurred! Aborting the script execution...'
		exit 1
    else
        echo "Making $output_name executable"
        chmod +x "$output_name"
	fi
done
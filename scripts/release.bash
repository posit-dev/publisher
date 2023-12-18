#!/usr/bin/env bash
set -euo pipefail
if [ "${DEBUG:-false}" = true ];
then
  set -x
fi


# Obtain the Git ref for use in output path.
#
# Use the GITHUB_REF value if supplied. Otherwise, stub a "fake" ref based on the current branch.
# See https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables
ref="${GITHUB_REF:-"heads/$(git rev-parse --abbrev-ref HEAD)"}"
ref=${ref#"refs/"}
echo "Reference: $ref" 1>&2

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
    echo "Archive: $archive" 1>&2

    object="s3://posit-publisher/$name/releases/$ref/$(basename $archive)"
    echo "Object: $object" 1>&2

    aws s3 cp $archive $object > /dev/null 2>&1
done

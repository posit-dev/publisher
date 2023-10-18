#!/usr/bin/env bash
set -euo pipefail

# Use gofmt to check for fmt compliance. When there are formatting problems,
# print the suggestions and exit with an error.
#
# gofmt is used because "go fmt" does not allow displaying the adjustment.
# Custom exit-code computation is used because gofmt/go fmt do not exit
# non-zero upon making suggested corrections.

# Exit with a non-zero code after checking all packages.
__EXITCODE=0

PACKAGES=$(go list -f '{{.Dir}}' ./...)
for pkg in ${PACKAGES}; do
    # shellcheck disable=SC2091
    # shellcheck disable=SC2034
    if $(gofmt -d -s "${pkg}"/*.go | read -r SCRATCH); then
        echo "Go source in package ${pkg} needs formatting"
        gofmt -d -s "${pkg}"/*.go
        __EXITCODE=1
    fi
done

exit $__EXITCODE

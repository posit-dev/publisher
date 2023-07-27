# clean, image, install, lint, build and test server & client (pre-run 'clean' if switching between use of DOCKER containers)
default: clean image install lint build post-build-lint test

_interactive := `tty -s && echo "-it" || echo ""`

_tag := "rstudio/connect-client:latest"

_with_runner := if env_var_or_default("DOCKER", "true") == "true" {
        "just _with_docker"
    } else {
        ""
    }

_uid_args := if "{{ os() }}" == "Linux" {
        "-u $(id -u):$(id -g)"
    } else {
        ""
    }

# Build both the web UX and server for production usage
build: 
    {{ _with_runner }} just web/build
    just _build

# Build the development server using the existing build of the Web UX
build-dev: 
    #!/bin/bash
    set -euo pipefail
    export BUILD_MODE=development

    just build

# Install any supporting packages (such as web UX javascript/typescript dependencies)
install:
    {{ _with_runner }} just web/install

# Build the web UX from scratch, lint and test
web:
    {{ _with_runner }} just web/clean
    {{ _with_runner }} just web/

# create the security certificates
certs:
    mkdir -p certs
    mkcert -cert-file ./certs/localhost-cert.pem -key-file ./certs/localhost-key.pem localhost 127.0.0.1 ::1 0.0.0.0

# Clean the server and web UX build artifacts as well as remove all web UX dependency packages.
clean:
    rm -rf ./bin
    {{ _with_runner }} just web/clean

# Lint the server and the web UX source code, along with checking for copyrights. See the `post-build-lint` recipe for linting which requires a build.
lint:
    ./scripts/fmt-check.bash
    ./scripts/ccheck.py ./scripts/ccheck.config
    {{ _with_runner }} just web/lint

# Lint and FIX automatically correctable issues. See the `lint` recipe for linting without fixing.
lint-fix:
    {{ _with_runner }} ./scripts/fmt-check.bash
    # This will fail even though fix flag is supplied (to fix errors).
    # We could suppress w/ cmd || true, but do we want to?
    {{ _with_runner }} ./scripts/ccheck.py ./scripts/ccheck.config --fix
    {{ _with_runner }} just web/lint-fix

# Lint step which requires the code to be built first. Normally want to lint prior to building.
post-build-lint:
    {{ _with_runner }} go vet -all ./...

# Run the publishing client executable
run *args:
    {{ _with_runner }} go run ./cmd/connect-client {{ args }}

# Run all tests (unit and e2e) on the publishing client as well as web UX
test:
    {{ _with_runner }} just web/test
    just test-backend

# Run the tests on the publishing client w/ coverage profiling
test-backend:
    {{ _with_runner }} go test ./... -covermode set -coverprofile cover.out

# Profile the test code coverage of the Go code
go-coverage: test-backend
    {{ _with_runner }} go tool cover -html=cover.out

# Build the image. Typically does not need to be done very often.
image:
    #!/bin/bash
    set -euo pipefail

    if "${DOCKER:-true}" == "true" ; then
        docker build \
            --build-arg BUILDKIT_INLINE_CACHE=1 \
            --pull \
            --tag {{ _tag }} \
            ./build/package
    fi

[private]
_build:
    #!/usr/bin/env bash
    set -euo pipefail

    # translate `just` os/arch strings to the ones `go build` expects
    os="{{ os() }}"
    arch="{{ arch() }}"

    # windows and linux strings match
    if [[ "$os" == "macos" ]]; then
        os=darwin
    fi

    if [[ "$arch" == "x86_64" ]]; then
        arch=amd64
    elif [[ "$arch" == "aarch64" ]]; then
        arch=arm64
    fi

    target=""

    echo ""
    if [ "${BUILD_MODE:-}" == "development" ]; then
        echo "Generating a ${BUILD_MODE} build of $os/$arch/connect-client."
        target="${os}/${arch}"
    else
        echo "Generating production builds of connect-client."
    fi

    # Have to remove linked server executable, so that switching from production 
    # to development modes (and vise-versa) will work.
    rm -rf ./bin

    if {{ _with_runner }} ./scripts/build.bash ./cmd/connect-client "${target}"; then
        echo "Build was successful"
    else
        echo ""
        echo "An error has occurred while building."
        echo ""
        if [ ! -f "web/dist/spa/index.html" ]; then
            echo "No web SPA artifacts can be found. A web build is required for the backend"
            echo "to build. Possibly resolve with 'just web/build' or 'just build'."
        fi
    fi

[private]
_with_docker *args: 
    docker run --rm {{ _interactive }} \
        -e GOCACHE=/work/.cache/go/cache \
        -e GOMODCACHE=/work/.cache/go/mod \
        -v "$(pwd)":/work \
        -w /work \
        {{ _uid_args }} \
        {{ _tag }} {{ args }}
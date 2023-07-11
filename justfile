# install, lint, build and test server & client (pre-run 'clean' if switching between use of DOCKER containers)
default: install lint build post-build-lint test

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

# Build the production web UX and the development server
build-dev: 
    #!/bin/bash
    set -euo pipefail

    if ! just _build_dev; then
     echo ""
     echo "A WEB build is required for the backend to build. Possibly resolve with 'just web/build' or 'just build'."
     exit 1
    fi


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
    go vet -all ./...

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
    go tool cover -html=cover.out

# Build the image. Typically does not need to be done very often.
image:
    docker build \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        --pull \
        --tag {{ _tag }} \
        ./build/package

[private]
_build:
    {{ _with_runner }} ./scripts/build.bash ./cmd/connect-client

[private]
_build_dev:
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

    {{ _with_runner }} ./scripts/build.bash ./cmd/connect-client "$os/$arch"

[private]
_with_docker *args: 
    docker run --rm {{ _interactive }} \
        -e GOCACHE=/work/.cache/go/cache \
        -e GOMODCACHE=/work/.cache/go/mod \
        -v "$(pwd)":/work \
        -w /work \
        {{ _uid_args }} \
        {{ _tag }} {{ args }}
default: clean lint test build

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

build: _web_build
    just _build

build-dev: _web_build
    just _build_dev

certs:
    mkdir -p certs
    mkcert -cert-file ./certs/localhost-cert.pem -key-file ./certs/localhost-key.pem localhost 127.0.0.1 ::1 0.0.0.0

clean:
    rm -rf ./bin
    just web/clean

lint:
    ./scripts/fmt-check.bash
    ./scripts/ccheck.py ./scripts/ccheck.config
    go vet -all ./...
    just web/lint

lint-fix:
    ./scripts/fmt-check.bash
    # This will fail even though fix flag is supplied (to fix errors).
    # We could suppress w/ cmd || true, but do we want to?
    ./scripts/ccheck.py ./scripts/ccheck.config --fix
    just web/lint --fix
    go vet -all ./...

run *args:
    {{ _with_runner }} go run ./cmd/connect-client {{ args }}

test: _web
    just test-backend

test-backend:
    {{ _with_runner }} go test ./... -covermode set -coverprofile cover.out

go-coverage: test-backend
    go tool cover -html=cover.out

[private]
_build:
    {{ _with_runner }} ./scripts/build.bash ./cmd/connect-client

[private]
_web_build:
    # output files are written to `web/dist/spa`. Need to place these where
    # the backend expects them to be.
    # following line fails:
    # [vite:esbuild] 
    # You installed esbuild on another platform than the one you're currently using.
    # This won't work because esbuild is written with native code and needs to
    # install a platform-specific binary executable.
    # {{ _with_runner }}  just web/install && just web/build
    just web/build

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
_image:
    docker build \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        --pull \
        --tag {{ _tag }} \
        ./build/package

[private]
_web:
    just web/

[private]
_with_docker *args: _image
    docker run --rm {{ _interactive }} \
        -e GOCACHE=/work/.cache/go/cache \
        -e GOMODCACHE=/work/.cache/go/mod \
        -v "$(pwd)":/work \
        -w /work \
        {{ _uid_args }} \
        {{ _tag }} {{ args }}
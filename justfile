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

build: _web
    just _build

build-dev: _web_build
    just _build_dev

certs:
    mkdir -p certs
    mkcert -cert-file ./certs/localhost-cert.pem -key-file ./certs/localhost-key.pem localhost 127.0.0.1 ::1 0.0.0.0

clean:
    rm -rf ./bin

lint:
    ./scripts/fmt-check.bash
    ./scripts/ccheck.py ./scripts/ccheck.config
    go vet -all ./...

run:
    {{ _with_runner }} go run ./cmd/connect-client

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
    just web/ build

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
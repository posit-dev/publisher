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
    {{ _with_runner }} ./scripts/build.bash ./cmd/connect-client

certs:
    mkdir -p certs
    mkcert -cert-file ./certs/localhost-cert.pem -key-file ./certs/localhost-key.pem localhost 127.0.0.1 ::1 0.0.0.0

clean:
    rm -rf ./bin

lint:
    ./scripts/fmt-check.bash
    ./scripts/ccheck.py ./scripts/ccheck.config
    go vet -all ./...

run *args:
    {{ _with_runner }} go run ./cmd/connect-client {{ args }}

test: _web
    {{ _with_runner }} \
        go test ./... -covermode set -coverprofile cover.out \
        && go tool cover -html=cover.out -o coverage.html

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
        -e CI="${CI:-false}" \
        -e GOCACHE=/work/.cache/go/cache \
        -e GOMODCACHE=/work/.cache/go/mod \
        -v "$(pwd)":/work \
        -w /work \
        {{ _uid_args }} \
        {{ _tag }} {{ args }}

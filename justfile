default: clean lint test build

_interactive := `tty -s && echo "-it" || echo ""`

_tag := "rstudio/connect-client:latest"

_with_runner := if env_var_or_default("DOCKER", "true") == "true" { 
        "just _with_docker" 
    } else { 
        "" 
    }

build: _web
    {{ _with_runner }} ./scripts/build.bash ./internal/cmd/connect-client

certs:
    mkdir -p certs
    mkcert -cert-file ./certs/localhost-cert.pem -key-file ./certs/localhost-key.pem localhost 127.0.0.1 ::1 0.0.0.0

clean:
    rm -rf ./bin

lint:
    ./scripts/fmt-check.sh
    ./scripts/ccheck.py ./scripts/ccheck.config
    go vet -all ./...

test:
    {{ _with_runner }} go test -race ./...

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
        -u $(id -u):$(id -g) \
        -v "$(pwd)":/work \
        -w /work \
        {{ _tag }} {{ args }}
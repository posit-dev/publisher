# Are we attached to a terminal?
interactive := `tty -s && echo "-it" || echo ""`

# environment variables for docker build
export DOCKER_BUILDKIT := "1"

version := `git describe --always --tags`

image := "rstudio/connect-client:latest"

# build and run the server
run: build start

# start the server
start:
    just container-run ./bin/linux-amd64/connect-client -debug

# build the server
build:
    mkdir -p .cache/go ui/dist
    just container-build \
        just src/connect-client/ build "{{ version }}"

# build the server for all platforms
build-all:
    mkdir -p .cache/go ui/dist
    just container-build \
        just src/connect-client/ build-all "{{ version }}"

# run server tests
test *args:
    just container-test \
        just src/connect-client/ test {{ args }}

# run linters
lint:
    ./scripts/ccheck.py ./scripts/ccheck.config
    just container-build \
        just _lint

# format shell scripts
format:
    just container-build \
        just _lint 1

_lint format='0':
    #!/usr/bin/env bash
    set -euxo pipefail

    # SCRIPTS=(
    # )

    # if [[ "{{ format }}" = "1" ]]; then
    #     shfmt -i 2 -bn -ci -sr -w ${SCRIPTS[*]}
    #     exit
    # fi

    just src/connect-client/ lint
    # shfmt -i 2 -bn -ci -sr -d ${SCRIPTS[*]}
    # shellcheck ${SCRIPTS[*]}

# build all artifacts
all:
    rm -f bin/connect-client
    just ui/ build
    just build

# inspect the running container
inspect:
    docker exec -it connect-client /bin/bash

# run in container
container-run *args:
    #!/usr/bin/env bash
    set -euxo pipefail
    args=()
    if [[ "$(uname)" = "Linux" ]]; then
        args=(--net host)
    fi

    docker run --rm {{ interactive }} --privileged --name connect-client \
        -e GOCACHE=/work/.cache/go/cache \
        -e GOMODCACHE=/work/.cache/go/mod \
        -e http_proxy=${http_proxy:-} \
        -e https_proxy=${https_proxy:-} \
        -e DEVELOPMENT=1 \
        -p 4242:4242 \
        ${args[*]:-} \
        -v "${HOME}"/.mitmproxy/mitmproxy-ca-cert.cer:/etc/pki/ca-trust/source/anchors/mitmproxy-ca-cert.crt \
        -v "$(pwd)":/work \
        -w /work \
        {{ image }} {{ args }}

# run in build container
container-build *args:
    docker run --rm {{ interactive }} \
        -e GOCACHE=/work/.cache/go/cache \
        -e GOMODCACHE=/work/.cache/go/mod \
        -u $(id -u):$(id -g) \
        -v "$(pwd)":/work \
        -v "$(pwd)/ui/dist":/work/src/connect-client/boot/static \
        -w /work \
        {{ image }} {{ args }}

# run in test container
container-test *args:
    docker run --rm {{ interactive }} --privileged \
        -e GOCACHE=/work/.cache/go/cache \
        -e GOMODCACHE=/work/.cache/go/mod \
        -v "$(pwd)":/work \
        -v "$(pwd)/ui/dist":/work/src/connect-client/boot/static \
        -w /work \
        {{ image }} {{ args }}

# build container image
container-image:
    docker build \
        --tag {{ image }} \
        --pull \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        --progress plain \
        ./docker

# pull container
container-image-pull:
    docker pull {{ image }}

# push container to Docker Hub
container-image-push:
    #!/usr/bin/env bash
    set -euo pipefail

    if tty -s; then
        # if interactive, prompt for confirmation
        echo "This will push the container '{{ image }}' to Docker Hub."
        read -r -p "Continue? [y/n] " answer
        [[ "${answer}" =~ [^yY].* ]] && exit
    fi

    docker push {{ image }}

# Run CI locally
local-ci:
    just container-image
    just ui/ local-ci
    just build lint test

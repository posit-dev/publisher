alias b := build
alias c := clean
alias co := cover
alias i := image
alias l := lint
alias r := run
alias t := test
alias w := web
alias v := version

_ci := "${CI:-false}"

_debug := env_var_or_default("DEBUG", "true")

_docker := env_var_or_default("DOCKER", "true")

_docker_platform := env_var_or_default("DOCKER_PLATFORM", env_var_or_default("DOCKER_DEFAULT_PLATFORM", "linux/amd64"))

_cmd := "./cmd/connect-client"

_interactive := `tty -s && echo "-it" || echo ""`

_mode := "${MODE:-dev}"

_with_debug := if "{{ _debug }}" == "true" {
        "set -x pipefail"
    } else {
        ""
    }

_uid_args := if "{{ os_family() }}" == "unix" {
        "-u $(id -u):$(id -g)"
    } else {
        ""
    }

default:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    just clean
    just lint
    just test
    just build

# Executes commands in ./test/bats/justfile. Equivalent to `just test/bats/`, but inside of Docker (i.e., just _with_docker just test/bats/).
bats *args:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    just _with_docker just test/bats/{{ args }}

# Compiles the application using Go. Executables are written to `./dist`. If invoked with `env CI=true` then executables for all supported architectures using the Go toolchain.
build:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    just _with_docker env MODE={{ _mode }} ./scripts/build.bash {{ _cmd }}

# Deletes ephemeral project files (i.e., cleans the project).
clean:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    just _with_docker rm -rf ./bin

# Display the code coverage collected during the last execution of `just test`.
cover:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    just _with_docker go tool cover -html=cover.out

# Executes commands in ./test/cy/justfile. Equivalent to `just test/cy/`, but inside of Docker (i.e., just _with_docker just test/cy/).
cy *args:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    just _with_docker just test/cy/{{ args }}

# Prints the executable path for this operating system. It may not exist yet (see `just build`).
executable-path:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    just _with_docker ./scripts/get-executable-path.bash {{ _cmd }} $(just version) $(go env GOOS) $(go env GOARCH)

# Build the image. Typically does not need to be done very often.
image:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    if ! ${DOCKER-true}; then
        exit 0
    fi

    case {{ _docker_platform }} in
        "linux/amd64")
            gochecksum=1241381b2843fae5a9707eec1f8fb2ef94d827990582c7c7c32f5bdfbfd420c8
            ;;
        "linux/arm64")
            gochecksum=fc90fa48ae97ba6368eecb914343590bbb61b388089510d0c56c2dde52987ef3
            ;;
        *)
            echo "error: DOCKER_PLATFORM not supported. Found \`"{{ _docker_platform }}"\`." 1>&2
            exit 1
            ;;
        esac


    docker build \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        --build-arg GOVERSION=1.21.3\
        --build-arg GOCHECKSUM=$gochecksum\
        --platform {{ _docker_platform }}\
        --pull \
        --tag $(just tag) \
        ./build/ci

# staticcheck, vet, and format check
lint: stub
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    # ./scripts/ccheck.py ./scripts/ccheck.config
    just _with_docker staticcheck ./...
    just _with_docker go vet -all ./...
    just _with_docker ./scripts/fmt-check.bash

# Prints the pre-release status based on the version (see `just version`).
pre-release:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    ./scripts/is-pre-release.bash

# Runs the CLI via `go run`.
run *args:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    just _with_docker $(just executable-path) {{ args }}

# Creates a fake './web/dist' directory for when it isn't needed.
stub:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    dir=web/dist

    if [ ! -d "$dir" ]; then
        mkdir -p $dir
        touch $dir/generated.txt
        echo "This file was created by ./scripts/stub.bash" >> $dir/generated.txt
    fi

# Prints the Docker image tag.
tag:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    echo "rstudio/connect-client:"$(just version)

# Execute unit tests.
test: stub
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    just _with_docker go test ./... -covermode set -coverprofile=cover.out

# Executes commands in ./web/Justfile. Equivalent to `just web/dist`, but inside of Docker (i.e., just _with_docker web/dist).
web *args:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    just _with_docker just web/{{ args }}

# Print the version.
version:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    ./scripts/get-version.bash

[private]
_with_docker *args:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    if ! {{ _docker }}; then
        {{ args }}
        exit 0
    fi

    if ! docker image inspect $(just tag) &>/dev/null; then
        just image
    fi

    docker run --rm {{ _interactive }}\
        -e CI={{ _ci }}\
        -e DEBUG={{ _debug }}\
        -e DOCKER=false\
        -e GOCACHE=/work/.cache/go/cache\
        -e GOMODCACHE=/work/.cache/go/mod\
        -e MODE={{ _mode }}\
        --platform {{ _docker_platform }}\
        -v "$(pwd)":/work\
        -w /work\
        $(just tag) {{ args }}

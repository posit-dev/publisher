# clean, image, bootstrap, lint, build and test agent & client
default: clean image lint test build


_ci := "${CI:-false}"

_cmd := "./cmd/connect-client"

_interactive := `tty -s && echo "-it" || echo ""`

_mode := "${MODE:-dev}"

_with_runner := if env_var_or_default("DOCKER", "true") == "true" {
        "just _with_docker"
    } else {
        ""
    }

_uid_args := if "{{ os() }}" == "Linux" {
        "$(id -u):$(id -g)"
    } else {
        ""
    }

# Compiles the application using Go. Executables are written to `./dist`. If invoked with `env CI=true` then executables for all supported architectures using the Go toolchain.
build:
    #!/usr/bin/env bash
    set -euo pipefail

    {{ _with_runner }} env MODE={{ _mode }} ./scripts/build.bash {{ _cmd }}

# Deletes ephermal project files (i.e., cleans the project).
clean:
    #!/usr/bin/env bash
    set -euo pipefail

    {{ _with_runner }} rm -rf ./bin

# Display the code coverage collected during the last execution of `just test`.
cover *FLAGS:
    #!/usr/bin/env bash
    set -euo pipefail

    # if {{ FLAGS }} == "--fresh"; then
    #     just test
    # fi

    {{ _with_runner }} go tool cover -html=cover.out

# Prints the executable path for this operating system. It may not exist yet (see `just build`).
executable-path:
    #!/usr/bin/env bash
    set -euo pipefail

    {{ _with_runner }} ./scripts/get-executable-path.bash {{ _cmd }} $(just version) $(go env GOOS) $(go env GOARCH)

# Build the image. Typically does not need to be done very often.
image:
    #!/usr/bin/env bash
    set -euo pipefail

    docker build \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        --pull \
        --tag $(just tag) \
        ./build/ci

# staticcheck, vet, and format check
lint: stub
    #!/usr/bin/env bash
    set -euo pipefail

    # ./scripts/ccheck.py ./scripts/ccheck.config
    {{ _with_runner }} staticcheck ./...
    {{ _with_runner }} go vet -all ./...
    {{ _with_runner }} ./scripts/fmt-check.bash

# Prints the pre-release status based on the version (see `just version`).
pre-release:
    #!/usr/bin/env bash
    set -euo pipefail

    ./scripts/is-pre-release.bash

# Runs the CLI via `go run`.
run *args:
    #!/usr/bin/env bash
    set -euo pipefail

    {{ _with_runner }} go run {{ _cmd }} {{ args }}

# Creates a fake './web/dist' directory for when it isn't needed.
stub:
    #!/usr/bin/env bash
    set -euo pipefail

    dir=web/dist

    if [ ! -d "$dir" ]; then
    mkdir -p $dir
    touch $dir/generated.txt
    echo "This file was created by ./scripts/stub.bash" >> $dir/generated.txt
    fi

# Prints the Docker image tag.
tag:
    #!/usr/bin/env bash
    set -euo pipefail

    echo "rstudio/connect-client:"$(just version)

# Execute unit tests.
test: stub
    #!/usr/bin/env bash
    set -euo pipefail

    {{ _with_runner }} go test ./... -covermode set -coverprofile=cover.out

# Executes commands in ./web/Justfile. Equivalent to `just web/dist`, but inside of Docker (i.e., just _with_docker web/dist).
web *args:
    #!/usr/bin/env bash
    set -euo pipefail

    {{ _with_runner }} just web/{{ args }}

# Print the version.
version:
    #!/usr/bin/env bash
    set -euo pipefail

    ./scripts/get-version.bash

[private]
_with_docker *args:
    #!/usr/bin/env bash
    set -euo pipefail

    if ! docker image inspect $(just tag) &>/dev/null; then
        just image
    fi

    docker run --rm {{ _interactive }} \
        -e CI={{ _ci }} \
        -e GOCACHE=/work/.cache/go/cache \
        -e GOMODCACHE=/work/.cache/go/mod \
        -v "$(pwd)":/work \
        -w /work \
        -u {{ _uid_args }} \
        $(just tag) {{ args }}

# Start the agent and show the UI
# NOTE: this must be called from within a docker container if so
# needed (it will not automatically use a running if defined)
# This is because this recipe is called from the web/justfile, which
# is already executing within a docker container (if configured to use)
start-agent-for-e2e:
    #!/usr/bin/env bash
    set -exuo pipefail

    # package=$(just executable-path)
    # if ! $package; then
    #     echo "error: Missing package. Run: `just build`." 1>&2
    #     exit 1
    # fi

    just run publish-ui \
        ./test/sample-content/fastapi-simple \
        --listen=127.0.0.1:9000 \
        --token=abc123

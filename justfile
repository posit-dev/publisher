# clean, image, bootstrap, lint, build and test agent & client
default: clean image lint test build

_interactive := `tty -s && echo "-it" || echo ""`

_ci := "${CI:-false}"

_mode := "${MODE:-dev}"

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

# Builds application
build:
    #!/usr/bin/env bash
    set -euo pipefail

    {{ _with_runner }} env MODE={{ _mode }} just web/build
    version=$(./scripts/get-version.bash)
    {{ _with_runner }} env MODE={{ _mode }} ./scripts/build.bash ./cmd/connect-client $version

# Remove built artifacts
clean:
    #!/usr/bin/env bash
    set -euo pipefail

    {{ _with_runner }} rm -rf ./bin

# Display the test code coverage of the Go code, from last test run
cover:
    #!/usr/bin/env bash
    set -euo pipefail

    {{ _with_runner }} go tool cover -html=cover.out


# Build the image. Typically does not need to be done very often.
image:
    #!/usr/bin/env bash
    set -euo pipefail

    if "${DOCKER:-true}" == "true" ; then
        docker build \
            --build-arg BUILDKIT_INLINE_CACHE=1 \
            --pull \
            --tag $(just tag) \
            ./build/package
    fi

# staticcheck, vet, and format check
lint: stub
    #!/usr/bin/env bash
    set -euo pipefail

    # ./scripts/ccheck.py ./scripts/ccheck.config
    {{ _with_runner }} staticcheck ./...
    {{ _with_runner }} go vet -all ./...
    {{ _with_runner }} ./scripts/fmt-check.bash

# print the pre-release status
pre-release:
    #!/usr/bin/env bash
    set -euo pipefail

    ./scripts/is-pre-release.bash

# run the agent
run *args:
    #!/usr/bin/env bash
    set -euo pipefail

    {{ _with_runner }} go run ./cmd/connect-client {{ args }}

# stub web/dist
stub:
    #!/usr/bin/env bash
    set -euo pipefail

    ./scripts/stub.bash

# print the Docker tag
tag:
    #!/usr/bin/env bash
    set -euo pipefail

    echo "rstudio/connect-client:"$(just version)

# execute test with coverage
test: stub
    #!/usr/bin/env bash
    set -euo pipefail

    {{ _with_runner }} go test ./... -covermode set -coverprofile=cover.out

web *args:
    #!/usr/bin/env bash
    set -euo pipefail

    {{ _with_runner }} just web/{{ args }}

# Print the version
version:
    #!/usr/bin/env bash
    set -euo pipefail

    ./scripts/get-version.bash

[private]
_with_docker *args:
    #!/usr/bin/env bash
    set -euo pipefail

    docker run --rm {{ _interactive }} \
        -e CI={{ _ci }} \
        -e GOCACHE=/work/.cache/go/cache \
        -e GOMODCACHE=/work/.cache/go/mod \
        -v "$(pwd)":/work \
        -w /work \
        {{ _uid_args }} \
        $(just tag) {{ args }}

# Start the agent and show the UI
# NOTE: this must be called from within a docker container if so
# needed (it will not automatically use a running if defined)
# This is because this recipe is called from the web/justfile, which
# is already executing within a docker container (if configured to use)
start-agent-for-e2e:
    #!/usr/bin/env bash
    set -exuo pipefail

    GOOS=$(go env GOOS)
    # remove \r from string when executed through docker
    GOOS="${GOOS%%[[:cntrl:]]}"

    GOARCH=$(go env GOARCH)
    # remove \r from string when executed through docker
    GOARCH="${GOARCH%%[[:cntrl:]]}"

    echo "Working directory is $(pwd)"

    ./bin/$GOOS/$GOARCH/connect-client* publish-ui \
        ./test/sample-content/fastapi-simple \
        --listen=127.0.0.1:9000 \
        --token=abc123

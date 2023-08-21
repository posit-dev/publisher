# clean, image, bootstrap, validate, build and test agent & client
default: clean image bootstrap validate build test

_interactive := `tty -s && echo "-it" || echo ""`

_ci := "${CI:-false}"

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

# bootstrap any supporting packages (such as go package or web UX javascript/typescript dependencies)
bootstrap:
    # No initialization needed for go code at this time.
    # bootstrap client
    {{ _with_runner }} just web/bootstrap

# Clean the agent and web UX build artifacts as well as remove all web UX dependency packages.
clean: clean-agent
    just web/clean

# Clean the agent's build artifacts
clean-agent:
    rm -rf ./bin/**/connect-client

# create the security certificates
certs:
    mkdir -p certs
    mkcert -cert-file ./certs/localhost-cert.pem -key-file ./certs/localhost-key.pem localhost 127.0.0.1 ::1 0.0.0.0

# Build both the web UX and agent for production usage
build: build-web build-agent

# Build the production agent using the existing build of the Web UX
build-agent:
    #!/usr/bin/env bash
    set -euo pipefail

    # Have to remove linked server executable, so that switching from production
    # to development modes (and vise-versa) will work.
    just clean-agent

    echo ""
    if [ "${BUILD_MODE:-}" == "development" ]; then
        echo "Generating a development build of connect-client."
    else
        echo "Generating production builds of connect-client."
    fi

    if {{ _with_runner }} ./scripts/build.bash ./cmd/connect-client; then
        echo "Build was successful"
    else
        echo ""
        echo "An error has occurred while building."
        echo ""
        if [ ! -f "./web/dist/spa/index.html" ]; then
            echo "No web SPA artifacts can be found. A web build is required for the backend"
            echo "to build. Possibly resolve with 'just web/build' or 'just build'."
        fi
    fi

# Build the development agent using the existing build of the Web UX
build-agent-dev:
    #!/bin/bash
    set -euo pipefail
    export BUILD_MODE=development

    just build-agent

# Build the web UX
build-web:
    {{ _with_runner }} just web/build

# Build the developer stack
build-dev:
    just clean image bootstrap build-web build-agent-dev

# Validate the agent and the web UX source code, along with checking for copyrights.
validate:
    #!/usr/bin/env bash
    set -euo pipefail

    ./scripts/ccheck.py ./scripts/ccheck.config
    {{ _with_runner }} just web/validate
    just validate-agent

validate-agent:
    #!/usr/bin/env bash
    set -euo pipefail

    # there must be files in web/dist/spa for go vet
    # so it can compile web/web.go which embeds it.
    web_dir=web/dist/spa
    if [[ ! -e ${web_dir} ]]; then
        mkdir -p ${web_dir}
        echo "placeholder" > ${web_dir}/placeholder
    fi
    {{ _with_runner }} staticcheck ./...
    {{ _with_runner }} go vet -all ./...
    {{ _with_runner }} ./scripts/fmt-check.bash
    rm -f ${web_dir}/placeholder

# Validate and FIX automatically correctable issues. See the `validate` recipe for linting without fixing.
validate-fix:
    #!/usr/bin/env bash
    set -euo pipefail

    # This will fail even though fix flag is supplied (to fix errors).
    # We could suppress w/ cmd || true, but do we want to?
    ./scripts/ccheck.py ./scripts/ccheck.config --fix
    {{ _with_runner }} just web/validate-fix

# Run all tests (unit and e2e) on the agent as well as web UX
test: test-agent test-web

# Run the tests on the agent w/ coverage profiling
test-agent:
    #!/usr/bin/env bash
    set -euo pipefail

    echo "Testing agent code"
    {{ _with_runner }} go test ./... -covermode set -coverprofile ./test/go_cover.out

# Display the test code coverage of the Go code, from last test run
test-agent-coverage:
    #!/usr/bin/env bash
    set -euo pipefail

    {{ _with_runner }} go tool cover -html=./test/go_cover.out -o ./test/go_coverage.html
    echo "" && echo "To view coverage HTML, open ./test/go_coverage.html with your browser"

# run the tests on the Web UX
test-web:
    {{ _with_runner }} just web/test

# Run the publishing agent executable w/ arguments
run-agent *args:
    #!/usr/bin/env bash
    set -euo pipefail

    {{ _with_runner }} go run ./cmd/connect-client {{ args }}

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

# Start the agent and show the UI
start-agent-for-e2e:
    #!/bin/bash
    set -exuo pipefail

    GOOS=$({{ _with_runner }} go env GOOS)
    # remove \r from string when executed through docker
    GOOS="${GOOS%%[[:cntrl:]]}"

    GOARCH=$({{ _with_runner }} go env GOARCH)
    # remove \r from string when executed through docker
    GOARCH="${GOARCH%%[[:cntrl:]]}"

    echo "Working directory is $(pwd)"

    ./bin/$GOOS-$GOARCH/connect-client publish-ui \
        ./test/sample-content/fastapi-simple \
        --listen=127.0.0.1:9000 \
        --token=abc123

[private]
_with_docker *args:
    docker run --rm {{ _interactive }} \
        -e CI={{ _ci }} \
        -e GOCACHE=/work/.cache/go/cache \
        -e GOMODCACHE=/work/.cache/go/mod \
        -v "$(pwd)":/work \
        -w /work \
        {{ _uid_args }} \
        {{ _tag }} {{ args }}

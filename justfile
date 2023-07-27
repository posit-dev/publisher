# clean, image, bootstrap, validate, build and test agent & client (pre-run 'clean' if switching between use of DOCKER containers)
default: clean image bootstrap validate build validate-post test

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

# bootstrap any supporting packages (such as go package or web UX javascript/typescript dependencies)
bootstrap:
    {{ _with_runner }} just cmd/connect-client/bootstrap
    {{ _with_runner }} just web/bootstrap

# Clean the agent and web UX build artifacts as well as remove all web UX dependency packages.
clean:
    just cmd/connect-client/clean
    just web/clean

# create the security certificates
certs:
    mkdir -p certs
    mkcert -cert-file ./certs/localhost-cert.pem -key-file ./certs/localhost-key.pem localhost 127.0.0.1 ::1 0.0.0.0

# Build both the web UX and agent for production usage
build: build-web build-agent

# Build the production agent using the existing build of the Web UX
build-agent:
    {{ _with_runner }} just cmd/connect-client/build

# Build the development agent using the existing build of the Web UX
build-agent-dev: 
    #!/bin/bash
    set -euo pipefail
    export BUILD_MODE=development

    just build-agent

# Build the web UX
build-web:
    {{ _with_runner }} just web/build

# Validate the agent and the web UX source code, along with checking for copyrights. See the `validate-post` recipe for linting which requires a build.
validate: 
    ./scripts/ccheck.py ./scripts/ccheck.config
    {{ _with_runner }} just cmd/connect-client/validate
    {{ _with_runner }} just web/validate

# Validate and FIX automatically correctable issues. See the `validate` recipe for linting without fixing.
validate-fix:
    # This will fail even though fix flag is supplied (to fix errors).
    # We could suppress w/ cmd || true, but do we want to?
    {{ _with_runner }} ./scripts/ccheck.py ./scripts/ccheck.config --fix
    {{ _with_runner }} just cmd/connect-client/validate
    {{ _with_runner }} just web/validate-fix

# Validate step which requires the code to be built first. Normally want to validate prior to building.
validate-post:
    {{ _with_runner }} go vet -all ./...

# Run all tests (unit and e2e) on the agent as well as web UX
test: test-agent test-web

# Run the tests on the agent w/ coverage profiling
test-agent:
    {{ _with_runner }} just cmd/connect-client/test

# run the tests on the Web UX
test-web:
    {{ _with_runner }} just web/test

# Display the test code coverage of the Go code, from last test run
test-agent-coverage: test-agent
    {{ _with_runner }} just cmd/connect-client/test-coverage

# Run the publishing agent executable
run-agent *args:
    {{ _with_runner }} just cmd/connect-client/run {{ args }}

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


[private]
_with_docker *args: 
    docker run --rm {{ _interactive }} \
        -e GOCACHE=/work/.cache/go/cache \
        -e GOMODCACHE=/work/.cache/go/mod \
        -v "$(pwd)":/work \
        -w /work \
        {{ _uid_args }} \
        {{ _tag }} {{ args }}
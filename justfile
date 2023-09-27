# clean, image, bootstrap, validate, build and test agent & client
default: clean image bootstrap validate build test

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

# bootstrap any supporting packages (such as go package or web UX javascript/typescript dependencies)
bootstrap:
    #!/usr/bin/env bash
    set -euo pipefail

    {{ _with_runner }} just web/bootstrap

# Remove built artifacts
clean:
    #!/usr/bin/env bash
    set -euo pipefail

    {{ _with_runner }} just web/clean
    {{ _with_runner }} rm -rf ./bin

# create the security certificates
certs:
    #!/usr/bin/env bash
    set -euo pipefail

    mkdir -p certs
    mkcert -cert-file ./certs/localhost-cert.pem -key-file ./certs/localhost-key.pem localhost 127.0.0.1 ::1 0.0.0.0

# Build both the web UX and agent for production usage
build:
    #!/usr/bin/env bash
    set -euo pipefail

    {{ _with_runner }} env MODE={{ _mode }} just web/build

    # _with_runner is not invoked since `./scripts/get-version.bash` executes `docker run`, which would result in a docker-in-docker scenario.
    version=$(./scripts/get-version.bash)
    {{ _with_runner }} env MODE={{ _mode }} ./scripts/build.bash ./cmd/connect-client $version

tag:
    #!/usr/bin/env bash
    set -euo pipefail

    echo "rstudio/connect-client:"$(just version)

version:
    #!/usr/bin/env bash
    set -euo pipefail

    ./scripts/get-version.bash

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

    # there must be files in web/dist for go vet
    # so it can compile web/web.go which embeds it.
    web_dir=web/dist
    if [[ ! -e ${web_dir} ]]; then
        mkdir -p ${web_dir}
        echo "placeholder" > ${web_dir}/placeholder
        trap "rm -f ${web_dir}/placeholder" EXIT
    fi
    {{ _with_runner }} staticcheck ./...
    {{ _with_runner }} go vet -all ./...
    {{ _with_runner }} ./scripts/fmt-check.bash

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
    #!/usr/bin/env bash
    set -euo pipefail

    echo $(just tag)
    if "${DOCKER:-true}" == "true" ; then
        docker build \
            --build-arg BUILDKIT_INLINE_CACHE=1 \
            --pull \
            --tag $(just tag) \
            ./build/package
    fi

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

    ./bin/$GOOS-$GOARCH/connect-client publish-ui \
        ./test/sample-content/fastapi-simple \
        --listen=127.0.0.1:9000 \
        --token=abc123

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

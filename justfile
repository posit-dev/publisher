alias a := all
alias b := build
alias c := clean
alias co := cover
alias im := image
alias l := lint
alias r := run
alias t := test
alias w := web
alias v := version

_ci := env_var_or_default("CI", "false")

_cmd := "./cmd/publisher"

_debug := env_var_or_default("DEBUG", "false")

_docker := env_var_or_default("DOCKER", if _ci == "true" { "true" } else { "false" })

_docker_file := "./build/ci/Dockerfile"

_docker_image_name := "rstudio/publisher"

_docker_platform := env_var_or_default("DOCKER_PLATFORM", env_var_or_default("DOCKER_DEFAULT_PLATFORM", "linux/amd64"))

_github_actions := env_var_or_default("GITHUB_ACTIONS", "false")

_interactive := `tty -s && echo "-it" || echo ""`

_mode := env_var_or_default("MODE", if _ci == "true" { "prod" } else { "dev" })

_target_platform := env("TARGETPLATFORM", "`go env GOOS`/`go env GOARCH`")

_with_debug := if _debug == "true" {
        "set -x pipefail"
    } else {
        ""
    }

_uid_args := if os_family() == "unix" {
        "-u $(id -u):$(id -g)"
    } else {
        ""
    }

# Quick start
default:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    just clean
    just web
    just build
    just package
    just archive

os:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    go env GOOS

arch:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    go env GOARCH

# Executes command against every justfile where avaiable. WARNING your mileage may very.
all +args='default':
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    # For each justfile, check if the first argument exists, and then execute it.
    for f in `find . -name justfile`; do
        arg=`echo {{ args }} | awk '{print $1;}'`
        if just -f $f --show $arg &>/dev/null; then
            just _with_docker just -f $f {{ args }}
        fi
    done

# Archives the application for distribution. Archives are written to `./archives`. If invoked with `env CI=true` then archives are create for all architectures supported by the Go toolchain.
archive:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    just _with_docker ./scripts/archive.bash {{ _cmd }}

# Executes commands in ./test/bats/justfile. Equivalent to `just test/bats/`, but inside of Docker (i.e., just _with_docker just test/bats/).
bats *args:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    just _with_docker just test/bats/{{ args }}

# Compiles the application using Go. Executables are written to `./bin`. If invoked with `env CI=true` then executables for all supported architectures using the Go toolchain.
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

    rm -rf ./archives
    rm -rf ./bin
    rm -rf ./dist

# Prints shell commands to configure executable on path. Configure your shell via: eval "$(just configure)"
configure:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    pathname=`just executable-path`
    if ! [ -f $pathname ]; then
        echo "info: ${pathname} not found. Running 'just build'." 1>&2
        just build 1>&2
    fi

    dir=`dirname $pathname`
    base=`basename "$pathname"`
    echo export PATH=`printf "%q" $PATH:$dir`

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
executable-path os="$(just os)" arch="$(just arch)":
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    just _with_docker echo '$(./scripts/get-executable-path.bash {{ _cmd }} $(just version) {{ os }} {{ arch }})'

# Fixes linting errors
fix:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

     ./scripts/ccheck.py ./scripts/ccheck.config --fix

# Build the image. Typically does not need to be done very often.
image:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    if ! {{ _docker }}; then
        exit 0
    fi

    docker buildx build \
        --cache-from type=gha\
        --cache-to type=gha,mode=min\
        --file {{ _docker_file }}\
        --load\
        --platform {{ _docker_platform }}\
        --progress plain\
        --tag $(just tag) \
        .

install:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    if [ ! `just _with_docker which staticcheck` ]; then
        just _with_docker go install honnef.co/go/tools/cmd/staticcheck@latest
        if [ ! `just _with_docker which staticcheck` ]; then
            echo "error: \`staticcheck\` not found. Is '\$GOPATH/bin' in your '\$PATH'?" 1>&2
            exit 1
        fi
    fi

# staticcheck, vet, and format check
lint: stub
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    ./scripts/ccheck.py ./scripts/ccheck.config
    just _with_docker staticcheck ./...
    just _with_docker go vet -all ./...
    just _with_docker ./scripts/fmt-check.bash

format:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    npm run format

check-format:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    npm run check-format

name:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    basename {{ _cmd }}

package:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    ./scripts/package.bash {{ _cmd }}

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

    echo {{ args }}
    just _with_docker '$(just executable-path)' {{ args }}

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

    echo {{ _docker_image_name }}":"$(just version)

# Execute unit tests.
test *args=("./..."): stub
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    just _with_docker go test {{ args }} -covermode set -coverprofile=cover.out

# Uploads distributions to object storage. If invoked with `env CI=true` then all architectures supported by the Go toolchain are uploaded.
upload *args:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    just _with_docker ./scripts/upload.bash {{ _cmd }} {{ args }}

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

# Executes commands in ./extensions/vscode/Justfile. Equivalent to `just extensions/vscode`, but inside of Docker (i.e., just _with_docker extension/vscode)
vscode *args:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    just _with_docker just extensions/vscode/{{ args }}

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
        --env-file <(env | grep AWS_)\
        --env-file <(env | grep GITHUB_)\
        --platform {{ _docker_platform }}\
        -v "$(pwd)":/work\
        -w /work\
        $(just tag)\
        /bin/bash -c  '{{ args }}'

alias a := all
alias b := build
alias c := clean
alias co := cover
alias l := lint
alias r := run
alias t := test
alias w := web
alias v := version

_ci := env_var_or_default("CI", "false")

_cmd := "./cmd/publisher"

_debug := env_var_or_default("DEBUG", "false")

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

PYTHON_VERSION := env("PYTHON_VERSION", "3.12.1")
QUARTO_VERSION := env("QUARTO_VERSION", "1.4.553")

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
            just -f $f {{ args }}
        fi
    done

# Archives the application for distribution. Archives are written to `./archives`. If invoked with `env CI=true` then archives are create for all architectures supported by the Go toolchain.
archive:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    ./scripts/archive.bash {{ _cmd }}

# Executes commands in ./test/bats/justfile. Equivalent to `just test/bats/`.
bats *args:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    just test/bats/{{ args }}

# Compiles the application using Go. Executables are written to `./bin`. If invoked with `env CI=true` then executables for all supported architectures using the Go toolchain.
build:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    env MODE={{ _mode }} ./scripts/build.bash {{ _cmd }}

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

    go tool cover -html=cover.out

# Executes commands in ./test/cy/justfile. Equivalent to `just test/cy/`.
cy *args:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    just test/cy/{{ args }}

# Prints the executable path for this operating system. It may not exist yet (see `just build`).
executable-path os="$(just os)" arch="$(just arch)":
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    ./scripts/get-executable-path.bash {{ _cmd }} $(just version) {{ os }} {{ arch }}

# Fixes linting errors
fix:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

     ./scripts/ccheck.py ./scripts/ccheck.config --fix

install:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    if [ ! `which staticcheck` ]; then
        go install honnef.co/go/tools/cmd/staticcheck@latest
        if [ ! `which staticcheck` ]; then
            echo "error: \`staticcheck\` not found. Is '\$GOPATH/bin' in your '\$PATH'?" 1>&2
            exit 1
        fi
    fi

npm-install:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    if [ {{ _ci }} = "true" ]; then
        npm ci --no-audit --no-fund | sed 's/^/debug: /'
    else
        npm install --no-audit --no-fund | sed 's/^/debug: /'
    fi

# staticcheck, vet, and format check
lint: stub
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    ./scripts/ccheck.py ./scripts/ccheck.config
    staticcheck ./...
    go vet -all ./...
    ./scripts/fmt-check.bash

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

package: npm-install
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

    pathname=`just executable-path`
    ${pathname} {{ args }}

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

# Execute unit tests.
test *args=("./..."): stub
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    go test {{ args }} -covermode set -coverprofile=cover.out

# Uploads distributions to object storage. If invoked with `env CI=true` then all architectures supported by the Go toolchain are uploaded.
upload *args:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    ./scripts/upload.bash {{ _cmd }} {{ args }}

# Executes commands in ./web/Justfile. Equivalent to `just web/dist.
web *args:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    just web/{{ args }}

# Print the version.
version:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    ./scripts/get-version.bash

# Executes commands in ./extensions/vscode/Justfile. Equivalent to `just extensions/vscode`.
vscode *args:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    just extensions/vscode/{{ args }}

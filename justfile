alias c := clean
alias f := format

_ci := env_var_or_default("CI", "false")

_debug := env_var_or_default("DEBUG", "false")

_with_debug := if _debug == "true" {
        "set -x pipefail"
    } else {
        ""
    }

PYTHON_VERSION := env("PYTHON_VERSION", "3.12.1")
QUARTO_VERSION := env("QUARTO_VERSION", "1.4.553")

# Quick start — delegates to the extension Justfile.
default:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    just vscode default

# Executes command against every justfile where available. WARNING your mileage may vary.
all +args='default':
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    for f in `find . -name justfile -not -path './node_modules/*'`; do
        arg=`echo {{ args }} | awk '{print $1;}'`
        if just -f $f --show $arg &>/dev/null; then
            just -f $f {{ args }}
        fi
    done

# Deletes ephemeral project files.
clean:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    rm -rf ./dist

npm-install:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    if [ {{ _ci }} = "true" ]; then
        npm ci --no-audit --no-fund
    else
        npm install --no-audit --no-fund
    fi

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

# Run extension contract tests (validates vscode/positron API usage)
test-extension-contracts:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    cd test/extension-contract-tests && npm test

# Check that vscode/positron mocks conform to real API type definitions
check-extension-contract-conformance:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    cd test/extension-contract-tests && npm run check:conformance

# Run Connect API contract tests
test-connect-contracts:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    cd test/connect-api-contracts && npm test

# Validate Connect API fixtures against the public Swagger spec
validate-fixtures:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    cd test/connect-api-contracts && npm run validate-fixtures

# Execute Python script tests (licenses, prepare-release, etc.)
test-scripts:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    python3 scripts/test_licenses.py
    python3 scripts/test_prepare_release.py

# Prints the pre-release status based on the version (see `just version`).
pre-release:
    #!/usr/bin/env bash
    set -eou pipefail
    {{ _with_debug }}

    ./scripts/is-pre-release.bash

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

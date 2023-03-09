top := `git rev-parse --show-toplevel`
output := top + "/bin"
binary := "connect-client"
version := `git describe --always --tags`

build os='linux' arch='amd64':
    #!/usr/bin/env bash
    set -euxo pipefail

    subdir="{{ os }}-{{ arch }}"
    mkdir -p "{{ output }}/$subdir"

    GOOS={{ os }} GOARCH={{ arch }} \
    go build \
        -ldflags "-X project.Version={{ version }}" \
        -o "{{ output }}" \
        ./internal/cmd/connect-client
    cd "{{ output }}"

    if [[ "{{ os }}" == "windows" ]]; then
        target="{{ binary }}.exe"
    else
        target="{{ binary }}"
    fi
    mv {{ output }}/connect-client* "{{ output }}/$subdir/$target"

build-all:
    just build linux amd64
    just build windows amd64
    just build darwin amd64
    just build darwin arm64

lint:
    ./fmt-check.sh
    go vet -all ./...

test *args:
    #!/usr/bin/env bash
    set -euxo pipefail

    test_args="{{ args }}"
    test_args=${test_args:-./...}

    go test -race ${test_args}

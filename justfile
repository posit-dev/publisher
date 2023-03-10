default: clean lint test build

lint:
    ./scripts/fmt-check.sh
    ./scripts/ccheck.py ./scripts/ccheck.config
    go vet -all ./...

test:
    go test -race ./...

build: _web
    ./scripts/build.bash ./internal/cmd/connect-client

clean:
    rm -r ./bin

[private]
_web:
    just web/
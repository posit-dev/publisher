# connect-client tests

These tests will use the `connect-client` binary in the following environments:
* windows-amd64 (Github Actions only)
* macos-amd64 (Github Actions only)
* linux-amd64 (Local Docker & Github Actions)
* linux-arm64 (Local Docker & Github Actions)

You can also run the tests against your local environment. 

First, build the docker containers needed:
```
just build 
```

Run against linux-amd64 and linux-arm64:
```
just run-client linux-amd64 
just run-client linux-arm64
```

These commands will build/use a docker container running the specified linux platform.

To run the tests against your local environment (replace `darwin-amd64` with the proper binary):

```
just run-client-local darwin-amd64
```
Running locally installs BATS locally in the `test/libs` directory (.gitignore'd).

Github Actions will use the virtual environment runners to test against `windows-amd64` and `darwin-amd64`.



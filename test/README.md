# connect-client tests

These tests will run the `connect-client` binary in the following environments:
* windows-amd64 (Github Actions only)
* macos-amd64 (Github Actions only)
* linux-amd64 (Local Docker & Github Actions)
* linux-arm64 (Local Docker & Github Actions)

To run the tests against your local environment (replace `darwin-amd64` with the proper binary):

We can run CLI tests or UI tests. 

## CLI Tests

To run CLI tests run the following command (replace `darwin-arm64` with your local OS and architecture).  This will run the CLI tests located in `./bats/`:

```
just local_test-cli darwin-amd64
```

To run against a linux os, first, build the docker containers needed (also works with `linux-arm64`):
```
just build linux-amd64
```

Start Connect and run publishing tests on `linux-amd64`:
```
just docker_init-connect linux-amd64 
```

By default the justfile sets `TEST_SCENARIO=basic` which loads the `environment/.basic` environment which sets the command arguments used to start the `connect-client` and deploys only the `fastapi-sample` content. If you'd like to run against all content available set `CONTENT=all_content` which will deploy all the content under `./sample-content/`. If you want to run a single deployment, set `CONTENT` to the path of any content you'd like to deploy, i.e.
```
CONTENT="test/sample-content/python/stock-dashboard-python/" just local_init-connect darwin-arm64
```


These commands will build/use a docker container running the specified linux platform.


Running locally installs BATS locally in the `test/libs` directory (.gitignore'd).

Github Actions will use the virtual environment runners to test against `windows-amd64` and `darwin-amd64`.



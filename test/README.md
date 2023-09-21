# connect-client tests

These tests will run the `connect-client` binary in the following environments:
* windows-amd64 (Github Actions only)
* macos-amd64 (Github Actions only)
* linux-amd64 (Local Docker & Github Actions)
* linux-arm64 (Local Docker & Github Actions)



## Binaries
First you'll need the `connect-client` binary to test with. If testing on your local OS, outside of Docker, in the root directory run:
```
just build
```

If you want to run tests against a linux binary in Docker, in this directory run:

```
just build-binary linux-amd64
```
(also works with `linux-arm64`)

## CLI Tests

To run CLI tests run the following command (replace `darwin-arm64` with your local OS and architecture).  This will run the CLI tests located in `./bats/`:

```
just test-cli darwin-amd64
```

To run against a Linux OS, first, build the docker containers needed:
```
just build linux-amd64
```

Now you can run the tests:

```
just docker_test-cli linux-amd64
```
(also works with `linux-arm64`)

## Publishing UI Tests to Connect

To run these tests locally, you'll need:
* access to Connect Fuzzbucket Credentials
* environment variables set for `FUZZBUCKET_CREDENTIALS` and `FUZZBUCKET_URL`.

To run the Publishing UI tests run the following command (replace `darwin-arm64` with your local OS and architecture).  This will start Connect in a fuzzbucket instance and run the Publish UI tests located in `../web/cypress/test`:

```
just init-connect-and-publish darwin-arm64
```

To run against a Linux OS first, build the docker containers needed (also works with `linux-arm64`):
```
just build linux-amd64
```

Now you can run the tests:

```
just docker_init-connect-and-publish linux-amd64
```

By default the `justfile` sets `TEST_SCENARIO=basic`. This loads the `environment/.basic` environment which sets the command arguments used to start the `connect-client`. By default we only deploy the `fastapi-sample` content. If you'd like to run against all content available set `CONTENT=all_content` which will deploy all the content under `./sample-content/`. If you want to run a single deployment, set `CONTENT` to the path of any content you'd like to deploy.

All Content Test:
```
CONTENT=all_content just init-connect-and-publish darwin-arm64
```

Single Content Test:
```
CONTENT="test/sample-content/python/stock-dashboard-python/" just init-connect-and-publish darwin-arm64
```




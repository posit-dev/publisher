# Tests

The following tests can all be run at the project root directory.

Note: These tests assume no accounts exist and no deployments have been made against the test content, so you may need to clear any saved accounts or previous deployments prior to running.

## bats tests

We use bats to test different segments of the publisher client. There are several targets that initiate tests for different components.

### deploy

These tests will start a Connect instance in EC2, retrieve content from the [connect-content ](https://github.com/rstudio/connect-content)repository and deploy each item to Connect running a series of tests found in [deploy.bats](https://github.com/posit-dev/publisher/tree/main/test/bats/contract/deploy.bats).

### init

These tests will not require a Connect instance but will retrieve content from the [connect-content](https://github.com/rstudio/connect-content) repository and call `init` against each item and run the tests found in [init.bats](https://github.com/posit-dev/publisher/blob/main/test/bats/cli/init.bats).

### common

These tests will not require a Connect instance or content. They run tests found in [common.bats](https://github.com/posit-dev/publisher/blob/main/test/bats/cli/common.bats).

### Running the tests

To run the tests, from the project root directory run the following command(s).

You will need to install bats before running the tests initially, to do so run:

```
just bats install
```

Then you can run one of the above tests:

```
just bats test [test-case]
```

## vscode-ui tests

We use the [webdriver.io VSCode Extension Service ](https://webdriver.io/docs/extension-testing/vscode-extensions) to test the VSCode UI components. These tests do not require a Connect instance nor extraneous content as it uses the content from our [sample-content directory](https://github.com/posit-dev/publisher/tree/main/test/sample-content).

To run the tests, from the project root directory run the following command(s).

You will need to install webdriver.io before running the tests initially, to do so run:

```
just vscode-ui install
```

Then you can run the tests:

```
just vscode-ui test
```

# Tests

The following tests can all be run at the project root directory.

Note: These tests assume no accounts exist and no deployments have been made against the test content, so you may need to clear any saved accounts or previous deployments prior to running.

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

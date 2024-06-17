# Contributing

## Prerequisites

Before you begin, make sure you have the following installed:

- [Visual Studio Code](https://code.visualstudio.com/download)
- [Node.js](https://nodejs.org/en)
- [Just](https://just.systems)

## Install Extension

To get this extension packaged and installed installed in VSCode, execute the
following Just commands from this directory.

```console
just
just install
```

Execute the following to uninstall the extension.

```console
just uninstall
```

## Development Workflow

### Configuration

To configure the project for development, run the following command. Invocation will download all project dependencies.

```console
just configure
```

### Testing

This project uses [Mocha](https://mochajs.org) for unit testing. Mocha is the default testing framework for Visual Studio Extension development.

The unit test code resides in `src/test`.

To execute the full unit test suite, execute the following command.

```console
just test
```

### Debugging

Utilize VSCode's built-in debugger to troubleshoot and diagnose issues.

Launch the debugger by pressing `F5` or go to `Run > Start Debugging`.

Either invocation will launch a new window named `Extension Host Development` with the extension installed and enabled.

When testing, utilize the sample projects in `../../test/sample-content`. Open these projects as a workspace within the `Extension Host Development` window.

### Re-building the Webview(s)

The built-in debugger watches for extension changes, but not changes for our
webviews. To rebuild the webviews without running the entire `just` or `just
package` command, run the following command replacing the prefix with the
webview you would like to build.

```console
npm run --prefix webviews/homeView build
```

### Packaging

This project uses [`@vscode/vsce`](https://github.com/microsoft/vscode-vsce) to build extension packages.

Run the following command to build a new package. The package is output to the `dist` directory.

```console
just package
```

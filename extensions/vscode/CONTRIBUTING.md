# Contributing

## Prerequisites

Before you begin, make sure you have the following installed:

- [Visual Studio Code](https://code.visualstudio.com/ownload)
- [Node.js](https://nodejs.org/en)
- [Just](https://just.systems)

## Quick Start

To get this project up and running on your local machine, execute the following Just commands from this directory.

This action will package the extension and install it on your system.

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

### Packaging

This project uses [`@vscode/vsce`](https://github.com/microsoft/vscode-vsce) to build packages.

Run the following command to build a new package. The package is output to the `../../packages` directory.

```console
just package
```

### Installation

To install the packaged extension on your machine, run the following command.

```
just install
```

### Uninstall

To uninstall the packaged extension from your machine, run the following command.

```
just uninstall
```

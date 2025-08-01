# Contributing

## Prerequisites

Before you begin, make sure you have the following installed:

- [Visual Studio Code](https://code.visualstudio.com/download)
  - The [`connor4312.esbuild-problem-matchers`](https://marketplace.visualstudio.com/items?itemName=connor4312.esbuild-problem-matchers) extension.
- [Node.js](https://nodejs.org/en)
- [Just](https://just.systems)

## Development Workflow

You can run the Posit Publisher extension with the changes you have locally by
using VS Code's extension development host.

### Run Extension

Open the `extensions/vscode` directory as the workspace in VS Code
and run the "Run Extension" debug launch configuration.

#### Important Note

The "Run Extension" launch configurations run the `extensions/vscode` esbuild
which will detect changes in the extension code.

If you have any changes in the Go server make sure to run `just build` in the
root directory.

If you have changes in the `webviews` make sure to rebuild them:

- `npm run --prefix webviews/homeView`

Running `just` in the root directory will rebuild and repackage everything
ensuring you have all code changes reflected when you run the extension in the
development host.

#### References

- [Our VS Code launch configuration file](.vscode/launch.json)
- [Our VS Code tasks file](.vscode/tasks.json)
- [VS Code debug configurations Launch configurations](https://code.visualstudio.com/docs/debugtest/debugging-configuration#_launch-configurations)
- [VS Code Bundling Extensions Using esbuild](https://code.visualstudio.com/api/working-with-extensions/bundling-extension#using-esbuild)

## Install Packaged Extension

You can also install the packaged extension to your VS Code install outside of
the extension development host. To do this run:

```console
just
just install
```

Execute the following to uninstall the extension.

```console
just uninstall
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

Switch to the debugger extension view within VSCode and select one of the two
debug configurations (specified within `extensions/vscode/.vscode/launch.json`):

- `Run Extension`
- `Run Extension using external API agent on 9001`

The first target (`Run Extension`) is very helpful when you are simply wanting to debug
functionality within the extension. It's configuration will cause the extension under test to
automatically launch the agent (unlike the second option).

The second target (`Run Extension using external API agent on 9001`) is helpful for when you want to debug
both the extension UX and the agent at the same time. To do this, you will need to:

1. First launch a debug session from a VSCode window which has opened the repo's base directory
   (see [API Debugging](./../../CONTRIBUTING.md#debugging-in-vs-code))
2. Then launch another debug session (using the `Run Extension using external API agent on 9001` configuration)
   from a separate VSCode window which has opened the `extensions/vscode` folder.

Notes when using `Run Extension using external API agent on 9001`:

- Both the agent's and extension's `launch.json` files are setup using the same working
  subdirectory of `test/sample-content`. If you change it in one, you will need to change it in the other.
  (This mimics the production runtime functionality where they both are initialized with the same working
  subdirectory.) This location must also be different than the root of the repository (which the VSCode
  window for agent development must open) and the extension location `extensions/vscode` (which the VSCode
  window for UX development must open).
- If you stop the debugging of the agent, you'll need to relaunch debugging of the extension after
  the agent is back up.

If you use `F5` or use the menu option `Run > Start Debugging` to launch the debugger,
be sure to pre-select the configuration.

Either invocation will launch a new window named `Extension Host Development` with the extension installed and enabled.

When testing, utilize the sample projects in `../../test/sample-content`. Open these projects as a workspace within the `Extension Host Development` window.

Debugging the home view is done with browser development tools. Activate the publisher extension within the
extension under test, and then use the palette command `Developer:Open Webview Developer Tools` to
launch the browser debugging window. Note: This command will appear to do nothing if there is no webview
visible within the extension at the time, so be sure to switch to the publisher extension view before issuing the command.

### Packaging

This project uses [`@vscode/vsce`](https://github.com/microsoft/vscode-vsce) to build extension packages.

Run the following command to build a new package. The package is output to the `dist` directory.

```console
just package
```

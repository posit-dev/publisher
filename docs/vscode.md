# VSCode Extension

## Quick Start

Install the extension.
[https://cdn.posit.co/publisher/releases/tags/v0.0.alpha2/publisher-0.0.alpha2.vsix](https://cdn.posit.co/publisher/releases/tags/v0.0.alpha2/publisher-0.0.alpha2.vsix).

To learn how to install a `.vsix` file, see the [*Install from a VSIX*](https://code.visualstudio.com/docs/editor/extension-marketplace#_install-from-a-vsix) guide from Visual Studio Code.

## Tutorial

Once installed, open *Posit Publisher* by clicking the icon in the editor menu bar. This will open the *Posit Publisher* UI.

See [./ui.md](./ui.md) for additional instructions.

![](https://cdn.posit.co/publisher/assets/img/tutorial.png)

## Command Pallette Commands

### Posit: Open Publisher

This command opens *Posit Publisher* in a new window or focuses on an existing window.

This command invokes the same action as clicking the *Posit Publisher* icon.

### Posit: Close Publisher

This command closes *Posit Publisher* and shuts down the server.

## Configuration

### `posit.publisher.executable.path`

By default, the extension uses the bundled Posit Publisher binary executable. To override this behavior, configure the `posit.publisher.executable.path` property in your *User* or *Workspace* settings.

![](https://cdn.posit.co/publisher/assets/img/settings.png)

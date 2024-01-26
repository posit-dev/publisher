# Posit Publisher

## Quick Start

Install the extension.
[https://cdn.posit.co/publisher/releases/tags/v0.0.alpha2/publisher-0.0.alpha2.vsix](https://cdn.posit.co/publisher/releases/tags/v0.0.alpha2/publisher-0.0.alpha2.vsix).

To learn how to install a `.vsix` file, see the [*Install from a VSIX*](https://code.visualstudio.com/docs/editor/extension-marketplace#_install-from-a-vsix) guide from Visual Studio Code.

## Tutorial

Once installed, open *Posit Publisher* by clicking the icon in the editor menu bar.

![](https://cdn.posit.co/publisher/assets/img/tutorial.png)

## Command Pallette Commands

### Posit: Open Publisher

This command opens *Posit Publisher* in a new window or focuses on an existing window.

This command invokes the same action as clicking the *Posit Publisher* icon.

When opening *Posit Publisher* for the first time, a background process is started on your machine. To shut down the background process, invoke the *Posit: Close Publisher* command.

### Posit: Close Publisher

This command closes *Posit Publisher* and shuts down the corresponding background process.

## Configuration

### `posit.publisher.executable.path`

If the Posit Publisher executable doesn't exist on `PATH`, the location may be manually configured using this setting.

Configure the `posit.publisher.executable.path` property in your *User* or *Workspace* settings.

![](https://cdn.posit.co/publisher/assets/img/settings.png)

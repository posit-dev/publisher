This page walks you through installation options for Posit Publisher.

## Installation for VSCode / Positron

The VSCode extension package includes everything you need to get started within
VSCode or Positron.

Download and install the VSCode extension.

- For Arm MacOS: [publisher-1.0.alpha8-darwin-arm64.vsix](https://cdn.posit.co/publisher/releases/tags/v1.0.alpha8/publisher-1.0.alpha8-darwin-arm64.vsix)
- For Intel MacOS: [publisher-1.0.alpha8-darwin-amd64.vsix](https://cdn.posit.co/publisher/releases/tags/v1.0.alpha8/publisher-1.0.alpha8-darwin-amd64.vsix)
- For Windows: [publisher-1.0.alpha8-windows-amd64.vsix](https://cdn.posit.co/publisher/releases/tags/v1.0.alpha8/publisher-1.0.alpha8-windows-amd64.vsix)
- For Arm Linux: [publisher-1.0.alpha8-linux-arm64.vsix](https://cdn.posit.co/publisher/releases/tags/v1.0.alpha8/publisher-1.0.alpha8-linux-arm64.vsix)
- For Intel Linux: [publisher-1.0.alpha8-linux-amd64.vsix](https://cdn.posit.co/publisher/releases/tags/v1.0.alpha8/publisher-1.0.alpha8-linux-amd64.vsix)

To learn how to install a `.vsix` file, see the [Install from a
VSIX](https://code.visualstudio.com/docs/editor/extension-marketplace#_install-from-a-vsix)
guide from Visual Studio Code.

## Quick install and updates

We have updates scripts for macOS and linux to download and install the latest version of the publisher:

#### Setup (one time)

First, [download the update script](https://raw.githubusercontent.com/posit-dev/publisher/main/install-publisher.bash) you will also have to mark it executable:

```bash

chmod u+x install-publisher.bash
```

You can put the script somewhere on your `$PATH` so you can run it from any directory, or add it to your `.bashrc` or `.zshrc`.

#### Usage

Run the script as follows:

```bash
./install-publisher.bash
```

Which will install the most recent release of the publisher.

You can also install nightlies with:

```bash
./install-publisher.bash nightly
```

Or install a specific version with:

```bash
./install-publisher.bash 1.0.alpha6
```

## Optional: Install Quarto

If you plan on deploying Quarto content having Quarto installed will allow
Posit Publisher to correctly detect Quarto application types for easier
deploying.

[Quarto - Get Started](https://quarto.org/docs/get-started/)

## Operating systems

The following operating systems are supported.

### macOS

- macOS 12 (Monterey)
- macOS 13 (Ventura)
- macOS 14 (Sonoma)

### Windows

- Windows 10
- Windows 11

### Linux

- RHEL 8
- RHEL 9
- Ubuntu 20.04 (focal)
- Ubuntu 22.04 (jammy)
- SUSE Linux Enterprise Server 15 SP5
- openSUSE 15.5

### Support grid

Operating system by chip architecture

|             | `darwin` | `linux` | `windows` |             |
| ----------: | :------: | :-----: | :-------: | :---------- |
| **`amd64`** |   `x`    |   `x`   |    `x`    | **`amd64`** |
| **`arm64`** |   `x`    |   `x`   |           | **`arm64`** |

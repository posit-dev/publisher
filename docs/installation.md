This page walks you through installation options for Posit Publisher.

## Installation for VSCode / Positron

The VSCode extension package includes everything you need to get started within
VSCode or Positron.

Download and install the VSCode extension.

- For Arm MacOS: [publisher-1.0.alpha2-darwin-arm64.vsix](https://cdn.posit.co/publisher/releases/tags/v1.0.alpha2/publisher-1.0.alpha2-darwin-arm64.vsix)
- For Intel MacOS: [publisher-1.0.alpha2-darwin-amd64.vsix](https://cdn.posit.co/publisher/releases/tags/v1.0.alpha2/publisher-1.0.alpha2-darwin-amd64.vsix)
- For Windows: [publisher-1.0.alpha2-windows-amd64.vsix](https://cdn.posit.co/publisher/releases/tags/v1.0.alpha2/publisher-1.0.alpha2-windows-amd64.vsix)
- For Arm Linux: [publisher-1.0.alpha2-linux-arm64.vsix](https://cdn.posit.co/publisher/releases/tags/v1.0.alpha2/publisher-1.0.alpha2-linux-arm64.vsix)
- For Intel Linux: [publisher-1.0.alpha2-linux-amd64.vsix](https://cdn.posit.co/publisher/releases/tags/v1.0.alpha2/publisher-1.0.alpha2-linux-amd64.vsix)

To learn how to install a `.vsix` file, see the [Install from a
VSIX](https://code.visualstudio.com/docs/editor/extension-marketplace#_install-from-a-vsix)
guide from Visual Studio Code.

## Optional: Install the CLI

If you want to try deploying from the command line, or use the UI in a browser,
install the `publisher` CLI.

### Script installation

**This method is available for macOS and Linux only.**

Follow the [manual installation](#manual-installation) instructions below for
other operating systems.

Paste the following command into your terminal or shell prompt.

The script explains what it does and then pauses before it does it.

```console
/bin/bash -c "$(curl -fsSL https://cdn.posit.co/publisher/install.bash)"
```

### Manual installation

1. Go to [GitHub
   releases](https://github.com/rstudio/publishing-client/releases).
1. Select the Posit Publisher version for installation.
1. Download the asset for your operating system and architecture. See below for
   additional information on operating systems and architectures.
1. Once downloaded, extract the archive file (e.g., unzip or untar).
1. Install the executable in a location available on your `PATH` (e.g.,
   `/usr/local/bin`).
    1. To view locations on your PATH, invoke `/bin/bash -c "echo $PATH"` from
       your terminal or shell prompt.
    1. In most cases, the correct installation location is `/usr/local/bin` on
       macOS and Linux operating systems.
    1. Use the following command to install and set the correct permissions on
       Linux or macOS:
    1. `sudo install -o root -g wheel -m 0755 ./bin/publisher /usr/local/bin`.
       Replace `/usr/local/bin` with your preferred installation directory.
       Otherwise, you may need to allow access manually after first invocation.

## Verification

### MacOS

Verify that you have installed Posit Publisher.

1. In MacOS, open Spotlight.
1. In the search box, type `Terminal`, then press Return.
1. In the Terminal window that appears, type the following command:

```console
publisher
```

#### Permissions

If prompted with the following, click **Ok**, then go to **Settings** ->
**Privacy & Security** and click **Always Allow**.

> “publisher” can’t be opened because Apple cannot check it for malicious
> software.

### Windows

Verify that you have installed Posit Publisher.

1. In Windows, click the Start menu.
1. In the search box, type `cmd`, then press Enter.
1. In the Command Prompt window that appears, type the following command:

```console
publisher
```

### Linux

Verify that you have installed Posit Publisher.

1. Open a shell prompt and type the following command.

```console
publisher
```

## Operating systems

The following operating systems are supported.

### macOS
- macOS 12 (Monterey)
- macOS 13 (Ventura)
- macOS 14 (Sonoma)

#### Architectures

##### Apple Silicon (M-Series) / ARMv8.5-A / ARMv8.6-A

When running MacOS with Apple silicon processors, install `darwin-arm64.tar.gz`.

This includes, but is not limited to, the following processors:

- Apple M1
- Apple M1 Pro
- Apple M1 Max
- Apple M1 Ultra
- Apple M2
- Apple M2 Pro
- Apple M2 Max
- Apple M2 Ultra
- Apple M3
- Apple M3 Pro
- Apple M3 Max

##### x86-64 / x86_64 / x64 / AMD64 / Intel 64

When running MacOS with x86-64 compliant processors, install
`darwin-amd64.tar.gz`.

This includes all Apple Mac products before Apple Silicon.

### Windows

- Windows 10
- Windows 11

#### Architectures

##### x86-64 / x86_64 / x64 / AMD64 / Intel 64

When running Windows with x86-64 compliant processors, install
`windows-amd64.tar.gz`.

### Linux

- RHEL 8
- RHEL 9
- Ubuntu 20.04 (focal)
- Ubuntu 22.04 (jammy)
- SUSE Linux Enterprise Server 15 SP5
- openSUSE 15.5

#### Architectures

##### ARM64 / AArch64 / ARMv8 / ARMv9

When running Linux with ARM64 compliant processors, install
`linux-arm64.tar.gz`.

##### x86-64 / x86_64 / x64 / AMD64 / Intel 64

When running Linux with x86-64 compliant processors, install
`linux-amd64.tar.gz`.

### Support grid

|             | `darwin` | `linux` | `windows` |             |
| ----------: | :------: | :-----: | :-------: | :---------- |
| **`amd64`** |   `x`    |   `x`   |    `x`    | **`amd64`** |
| **`arm64`** |   `x`    |   `x`   |           | **`arm64`** |

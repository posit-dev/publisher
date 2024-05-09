This page walks you through installation options for Posit Publisher.

## Installation for VSCode / Positron

The VSCode extension package includes everything you need to get started within
VSCode or Positron.

Download and install the VSCode extension.

- For Arm MacOS: [publisher-1.0.alpha4-darwin-arm64.vsix](https://cdn.posit.co/publisher/releases/tags/v1.0.alpha4/publisher-1.0.alpha4-darwin-arm64.vsix)
- For Intel MacOS: [publisher-1.0.alpha4-darwin-amd64.vsix](https://cdn.posit.co/publisher/releases/tags/v1.0.alpha4/publisher-1.0.alpha4-darwin-amd64.vsix)
- For Windows: [publisher-1.0.alpha4-windows-amd64.vsix](https://cdn.posit.co/publisher/releases/tags/v1.0.alpha4/publisher-1.0.alpha4-windows-amd64.vsix)
- For Arm Linux: [publisher-1.0.alpha4-linux-arm64.vsix](https://cdn.posit.co/publisher/releases/tags/v1.0.alpha4/publisher-1.0.alpha4-linux-arm64.vsix)
- For Intel Linux: [publisher-1.0.alpha4-linux-amd64.vsix](https://cdn.posit.co/publisher/releases/tags/v1.0.alpha4/publisher-1.0.alpha4-linux-amd64.vsix)

To learn how to install a `.vsix` file, see the [Install from a
VSIX](https://code.visualstudio.com/docs/editor/extension-marketplace#_install-from-a-vsix)
guide from Visual Studio Code.

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

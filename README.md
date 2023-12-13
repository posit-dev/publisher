# Posit Publisher

## Table of Contents

- [Posit Publisher](#posit-publisher)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
    - [Manual Installation](#manual-installation)
  - [Verification](#verification)
    - [MacOS](#macos)
    - [Windows](#windows)
    - [Linux](#linux)
  - [Operating Systems](#operating-systems)
    - [macOS](#macos-1)
    - [Architectures](#architectures)
      - [Apple Silicon (M-Series) / ARMv8.5-A / ARMv8.6-A](#apple-silicon-m-series--armv85-a--armv86-a)
      - [x86-64 / x86\_64 / x64 / AMD64 / Intel 64](#x86-64--x86_64--x64--amd64--intel-64)
    - [Windows](#windows-1)
    - [Architectures](#architectures-1)
      - [x86-64 / x86\_64 / x64 / AMD64 / Intel 64](#x86-64--x86_64--x64--amd64--intel-64-1)
    - [Linux](#linux-1)
    - [Architectures](#architectures-2)
      - [ARM64 / AArch64 / ARMv8 / ARMv9](#arm64--aarch64--armv8--armv9)
      - [x86-64 / x86\_64 / x64 / AMD64 / Intel 64](#x86-64--x86_64--x64--amd64--intel-64-2)
    - [Support Grid](#support-grid)


## Installation

**This method is only supported on MacOS and Linux.**

Paste the following command into your terminal or shell prompt.

The script explains what it will do and then pauses before it does it. Read about other installation options below.

```console
/bin/bash -c "$(curl -fsSL https://cdn.posit.co/publisher/install.bash)"
```

### Manual Installation

1. Go to [GitHub releases](https://github.com/rstudio/publishing-client/releases).
1. Select the version for installation.
1. Download the asset for your operating system and architecture. See below for additional information on operating systems and architectures.
1. Once downloaded, extract the archive file (e.g., unzip or untar).
1. Place the executable in a location available on your `PATH` (e.g., `/usr/local/bin`).
    - To view locations on your PATH, invoke `/bin/bash -c "echo $PATH"` from your terminal or shell prompt.
    - In most cases, the correctly installation location in `/usr/local/bin` on macOS and Linux operating systems.

## Verification

### MacOS

Verify that you have installed Posit Publisher

1. In MacOS, open Spotlight.
1. In the search box, type `Terminal`, and press Return.
1. In the Terminal window that appears, type the following command.

```console
publisher
```

### Windows

Verify that you have installed Posit Publisher.

1. In Windows, click the Start menu.
1. In the search box, type `cmd`, then press Enter.
1. In the Command Prompt window that appears, type the following command.

```console
publisher
```

### Linux

Verify that you have installed Posit Publisher.

1. Open a shell prompt and type the following command.

```console
publisher
```

## Operating Systems

The following operating systems are supported.

### macOS
- macOS 12 (Monterey)
- macOS 13 (Ventura)
- macOS 14 (Sonoma)

### Architectures

#### Apple Silicon (M-Series) / ARMv8.5-A / ARMv8.6-A

When running MacOS with Apple silicon processors install `darwin-arm64.tar.gz`.

This includes, but is not limited to the following processors:

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

#### x86-64 / x86_64 / x64 / AMD64 / Intel 64

When running MacOS with x86-64 compliant processors install `darwin-amd64.tar.gz`.

This includes, all Apple Mac products prior to Apple Silicon.

### Windows

- Windows 10
- Windows 11

### Architectures

#### x86-64 / x86_64 / x64 / AMD64 / Intel 64

When running Windows with x86-64 compliant processors install `windows-amd64.tar.gz`.

### Linux

- RHEL 8
- RHEL 9
- Ubuntu 20.04 (focal)
- Ubuntu 22.04 (jammy)
- SUSE Linux Enterprise Server 15 SP5
- openSUSE 15.5

### Architectures

#### ARM64 / AArch64 / ARMv8 / ARMv9

When running Linux with ARM64 compliant processors install `linux-arm64.tar.gz`.

#### x86-64 / x86_64 / x64 / AMD64 / Intel 64

When running Linux with x86-64 compliant processors install `linux-amd64.tar.gz`.

### Support Grid

|             | `darwin` | `linux` | `windows` |             |
| ----------: | :------: | :-----: | :-------: | :---------- |
| **`amd64`** |   `x`    |   `x`   |    `x`    | **`amd64`** |
| **`arm64`** |   `x`    |   `x`   |           | **`arm64`** |

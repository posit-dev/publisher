# Posit Publisher

## Installation

**This method is only supported on MacOS and Linux.**

Paste the following command into your terminal or shell prompt.

The script explains what it will do and then pauses before it does it. Read about other installation options below.

```console
/bin/bash -c "$(curl -fsSL https://cdn.posit.co/publisher/install.bash)"
```

## Manual Installation

1. Go to [GitHub releases](https://github.com/rstudio/publishing-client/releases).
1. Select the version for installation.
1. Download the asset for your operating system and architecture. See below for additional information on operating systems and architectures.
1. Once downloaded, extract the archive file (e.g., unzip or untar).
1. Place the executable in a location available on your `PATH` (e.g., `/usr/local/bin`).
    - To view locations on your PATH, invoke `/bin/bash -c "echo $PATH"` from your terminal or shell prompt.
    - In most cases, the correctly installation location in `/usr/local/bin` on macOS and Linux operating systems.

### Verification

#### MacOS

Verify that you have installed Posit Publisher

1. In MacOS, open Spotlight.
1. In the search box, type `Terminal`, and press Return.
1. In the Terminal window that appears, type the following command.

```console
publisher
```

#### Windows

Verify that you have installed Posit Publisher.

1. In Windows, click the Start menu.
1. In the search box, type `cmd`, then press Enter.
1. In the Command Prompt window that appears, type the following command.

```console
publisher
```

#### Linux

Verify that you have installed Posit Publisher.

1. Open a shell prompt and type the following command.

```console
publisher
```

### Operating Systems

The following operating systems are supported.

- MacOS Monterey (12.7.2)
- Ubuntu 22.04 (jammy)
- Windows 11

When choosing a distribution, use the following guide.

### MacOS / Intel x86

When running MacOS with Intel x86 processors download `darwin-amd64.tar.gz`.

This includes, all Apple Mac products prior to Apple Silicon.

### MacOS / Apple Silicon (M-Series)

When running MacOS with Apple silicon processors download `darwin-arm64.tar.gz`.

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

### Windows / Intel x86

When running Windows with Intel x86 processors download `windows-amd64.zip`.

### Ubuntu (Linux) / Intel x86

When running Ubuntu with Intel x86 processors download `linux-amd64.tar.gz`.

### Ubuntu (Linux) / ARM

When running Ubuntu with Intel x86 processors download `linux-arm64.tar.gz`.

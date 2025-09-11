This page walks you through installation options for Posit Publisher.

## Installation for Positron and VS Code

[Install via the Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Posit.publisher)

Or open the VS Code Extensions view and search for "Posit Publisher" and then click "Install".

## Installation of the pre-release version

If a pre-release version is available, you can install it by following the same steps as above and then after installation click "Switch to Pre-release Version".

If the "Switch to Pre-release Version" button is not available there is currently no pre-release version available or you are already on a pre-release version.

## Installation using the Open VSX Registry

[Open the Publisher extension page on Open VSX Registry](https://open-vsx.org/extension/posit/publisher)

On the extension's page, click the "Download" button to download the extension as a .vsix file.

Open your IDE extension manager and look for an option to install from a .vsix file. Select the downloaded .vsix file to install the extension.

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

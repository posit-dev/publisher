# Posit Publisher

Posit Publisher lets you deploy projects to Connect from VS Code and Positron.

Key concepts:

- Publisher is a VS Code
  extension that presents a UI within the VS Code and Positron sidebar.
- Deployment options are set via configuration files in `.posit/publish/`.
- Records of where you have deployed are kept in `.posit/publish/deployments`.

For a full list of features and supported content types, see the
[extension README](../extensions/vscode/README.md).

## Installation

[Install via the Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Posit.publisher)

Or open the VS Code Extensions view and search for "Posit Publisher" and then click "Install".

### Pre-release version

If a pre-release version is available, you can install it by following the same steps as above and then after installation click "Switch to Pre-release Version".

If the "Switch to Pre-release Version" button is not available there is currently no pre-release version available or you are already on a pre-release version.

### Open VSX Registry

[Open the Publisher extension page on Open VSX Registry](https://open-vsx.org/extension/posit/publisher)

On the extension's page, click the "Download" button to download the extension as a .vsix file.

Open your IDE extension manager and look for an option to install from a .vsix file. Select the downloaded .vsix file to install the extension.

### Optional: Install Quarto

If you plan on deploying Quarto content having Quarto installed will allow
Posit Publisher to correctly detect Quarto application types for easier
deploying.

[Quarto - Get Started](https://quarto.org/docs/get-started/)

## Using the Extension

See the [VS Code Extension](vscode.md) page.

## Configuration Reference

See the [Configuration Reference](configuration.md) page.

## Troubleshooting

See the [Troubleshooting](troubleshooting.md) page.

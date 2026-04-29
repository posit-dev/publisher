# Posit Publisher

Posit Publisher lets you deploy projects to Connect from VS Code and Positron.

Key concepts:

- Publisher is a VS Code
  extension that presents a UI within the VS Code and Positron sidebar.
- Deployment options are set via configuration files in `.posit/publish/`.
- Records of where you have deployed are kept in `.posit/publish/deployments`.

## Features

Supported features:

- Deploy projects to Connect
- UI available as a VS Code extension
- Configuration-file based workflow
- Configuration schema enables editing with the [Even Better TOML
  VS Code](https://marketplace.visualstudio.com/items?itemName=tamasfe.even-better-toml)
  extension
- Python content: APIs, applications, and notebooks
- Quarto content: .qmd and .Rmd files. Support for embedded Shiny apps
- R content: Shiny apps, RMarkdown, Plumber APIs, and Rmd with embedded Shiny apps
- Automatic detection of client R, Python and Quarto versions
- Dependencies from `requirements.txt` and/or `renv.lock` files
- Automatic creation of a minimal `requirements.txt` file if needed, by scanning imports and mapping them to package names/versions installed in the local Python library path.
- Collaborate via git, or by downloading a source bundle from Connect
- Pre-flight checking of settings before deploying to Connect
- Verification that deployed apps can successfully start
- View and manage OAuth Integration content requirements directly from the "Integration Requests" pane in the Publisher UI.

## Installation

See the [Installation](installation.md) page.

## Using the Extension

See the [VS Code Extension](vscode.md) page.

## Configuration Reference

See the [Configuration Reference](configuration.md) page.

## Troubleshooting

See the [Troubleshooting](troubleshooting.md) page.

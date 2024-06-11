# Posit Publisher

Posit Publisher lets you deploy projects to Connect from VSCode.

Key concepts:

- Publisher is a VSCode
  extension that presents a UI within the VSCode left activity panel.
- Deployment options are set via configuration files in `.posit/publish/`.
- Records of where you have deployed are kept in `.posit/publish/deployments`.

## Features

Supported features:

- Deploy projects to Connect
- UI available as a VSCode extension
- Configuration-file based workflow
- Configuration schema enables editing with the [Even Better TOML
  VSCode](https://marketplace.visualstudio.com/items?itemName=tamasfe.even-better-toml)
  extension
- Python content: APIs, applications, and notebooks
- Quarto content: .qmd, .Rmd, and .ipynb files. Support for embedded Shiny apps
- R content: Shiny apps, RMarkdown, Plumber APIs, and Rmd with embedded Shiny apps
- Automatic detection of client R, Python and Quarto versions
- Dependencies from requirements.txt and/or renv.lock files
- Automatic creation of a minimal requirements.txt file if needed, by scanning imports and mapping them to package names/versions installed in the local Python library path.
- Collaborate via git, or by downloading a source bundle from Connect
- Pre-flight checking of settings before deploying to Connect
- Verification that deployed apps can successfully start

What's not supported yet but is on our to-do list:

- Deploy to servers other than Connect
- Show more information in the UI such as changes since last deployment
- Inject secrets as environment variables
- More metadata such as tags, thumbnail image, etc
- Configure permissions for sharing
- Option to export a `manifest.json` for compatibility with prior tool
- Schedule reports
- Streamlined `update deployment` command in VSCode command palette
- Support VSCode windows with multiple workspaces, or deploy from a
  subdirectory of the workspace
- Better error handling

## Installation

See the [Installation](installation.md) page.

## Using the Extension

See the [VSCode Extension](vscode.md) page.

## Configuration Reference

See the [Configuration Reference](configuration.md) page.

## Acknowledgements

See the [Licenses](licenses.md) page.

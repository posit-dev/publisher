# Posit Publisher

Posit Publisher lets you deploy projects to Connect. This version only supports
Python projects, and Quarto projects using Python. Support for R projects is
planned for a later release.

Key concepts:

- Publisher provides a binary with a CLI and an API server. There is also a VSCode
  extension that presents a UI within the VSCode left activity panel.
- Deployment options are set via a configuration file in `.posit/publish/`.
- Records of where you have deployed are kept in `.posit/publish/deployments`.
- Accounts/credentials are currently read from rsconnect and rsconnect-python.

## Features

Supported features:

- Deploy projects to Connect
- UI available via VSCode extension
- Deploy using CLI
- Configuration-file based workflow
- Configuration schema enables editing with the [Even Better TOML
  VSCode](https://marketplace.visualstudio.com/items?itemName=tamasfe.even-better-toml)
  extension
- Exclude files from deployment with `.positignore` files (like `.gitignore`)
- Python content: APIs, applications, and notebooks
- Automatic detection of client Python and Quarto version
- Automatic creation of a minimal requirements.txt file if needed, by scanning imports and mapping them to package names/versions installed in the local Python library path.
- Deploy Quarto documents (using the `jupyter` and `markdown` engines only)
- Collaborate via git, or by downloading a source bundle from Connect
- Uses existing publishing accounts from `rsconnect` and `rsconnect-python`
- Pre-flight checking of settings before deploying to Connect
- Verification that deployed apps can successfully start

What's not supported yet but is on our to-do list:

- Deploy to servers other than Connect (shinyapps.io, Cloud, etc)
- Manage the list of accounts and provide an import function for existing
  accounts
- R content such as Shiny, R Markdown, and Quarto (with the `knitr` engine)
- Automatic detection of R version and dependencies
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

## Getting Started

There are two ways to deploy content.

- [publisher cli](cli.md)
- [Posit Publisher extension in Positron + VSCode](vscode.md)

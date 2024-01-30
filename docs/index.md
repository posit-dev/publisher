# Posit Publisher

Posit Publisher lets you publish projects to Connect. This version only supports
Python projects, and Quarto projects using Python. Support for R projects is
planned for a later release.

Key concepts:
* Publisher provides a binary with a CLI and a UI server. There is also a VSCode
  extension that runs the binary and hosts the UI in VSCode.
* Deployment options are set via a configuration file in `.posit/publish/`.
* Records of where you have deployed are kept in `.posit/publish/deployments`.
* Accounts/credentials are currently read from rsconnect and rsconnect-python.


## Features

Supported features:

* Publish projects to Connect
* UI available via VSCode extension
* Publish using CLI, or launch the UI for browser access
* Configuration-file based workflow
* Configuration schema enables editing with the [Even Better TOML
  VSCode](https://marketplace.visualstudio.com/items?itemName=tamasfe.even-better-toml)
  extension
* Exclude files from deployment with `.positignore` files (like `.gitignore`)
* Python content: APIs, applications, and notebooks
* Automatic detection of client Python and Quarto version
* Automatic creation of a requirements.txt file (using `pip freeze`) if needed
* Publish Quarto documents (using the `jupyter` and `markdown` engines only)
* Collaborate via git, or by downloading a source bundle from Connect
* Uses existing publishing accounts from `rsconnect` and `rsconnect-python`
* Pre-flight checking of settings before deploying to Connect
* Verification that deployed apps can successfully start

What's not supported yet but is on our to-do list:

* Publish to servers other than Connect (shinyapps.io, Cloud, etc)
* Manage the list of accounts and provide an import function for existing
  accounts
* R content such as Shiny, R Markdown, and Quarto (with the `knitr` engine)
* Automatic detection of R version and dependencies
* Support for multiple configuration files and configuration editing in the UI
* Show more information in the UI such as package dependencies
* Inject secrets as environment variables
* More metadata such as tags, thumbnail image, etc
* Configure permissions for sharing
* Option to export a `manifest.json` for compatibility with prior tool
* Schedule reports
* Streamlined `update deployment` command in VSCode extension
* Support VSCode windows with multiple workspaces, or publish from a
  subdirectory of the workspace
* Better error handling


## Installation
See the [Installation](installation.md) page.

## Getting Started
There are three ways to publish content.
* [publisher cli](cli.md)
* [publisher ui](ui.md)
* [Publish Assistant in Positron + VSCode](vscode.md)

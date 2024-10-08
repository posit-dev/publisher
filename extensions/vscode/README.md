# Posit Publisher - Deploy to Posit Connect

[Posit Publisher](https://github.com/posit-dev/publisher) is a code-first tool
with a push-button user interface for deploying the things you build in R and
Python to [Posit Connect](https://posit.co/products/enterprise/connect/).

Supported content includes:

- Python content: APIs, applications, and notebooks
- Quarto content: `.qmd` and `.Rmd` files. Support for embedded Shiny apps
- R content: Shiny apps, RMarkdown, Plumber APIs, and Rmd with embedded
  Shiny apps

## Installation

Install Posit Publisher by using the **Install** button above, or using the
**Extensions** side bar in [Positron](https://github.com/posit-dev/positron) or
[VS Code](https://code.visualstudio.com/) and searching for `posit.publisher`.

Posit Publisher is available from the
[Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Posit.publisher)
or from the [Open VSX Registry](https://open-vsx.org/extension/posit/publisher).

## Features

### Code-first deployment

Configure your content and then deploy to Posit Connect with a click.

[Configuration files](https://github.com/posit-dev/publisher/blob/main/docs/configuration.md)
allow setting up how you want your content to look and run on Connect - from
choosing a title and description to
[Runtime process settings](https://docs.posit.co/connect/user/content-settings/#content-runtime).

Keep your content stable with language and tool versions set in your
configurations — all automatically detected based on your local environment.

Everything is saved in the `.posit/` directory for easy re-deployment and
collaboration.

### Seamless collaboration

Allow Collaborators to easily pick up where you left off by committing the
`.posit/` directory to your version control system. Your team can deploy using
the same deployments and configurations.

### Track all deployments for a project

Easily track all deployments for a project with Posit Publisher.

For example, create separate deployments for staging and production.

### Deployment logs

Logs are organized to easily identify what went wrong.

<img
  src="https://camo.githubusercontent.com/a74aa7b8bc2d2a67508b51764757b4692dea2bb451a8f5f8e876d00e4125a09e/68747470733a2f2f63646e2e706f7369742e636f2f7075626c69736865722f6173736574732f696d672f6465706c6f796d656e742d6c6f67732d76696577322e706e67"
  alt="Deploying Logs with organized steps in the Posit Publisher Logs view"
/>

## Help and feedback

Documentation can be found in the
[open source repository](https://github.com/posit-dev/publisher/blob/main/docs/index.md).

Report bugs or request features using
[GitHub Issues](https://github.com/posit-dev/publisher/issues).

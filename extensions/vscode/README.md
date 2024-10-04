# Posit Publisher - Deploy to Posit Connect

[Posit Publisher](https://github.com/posit-dev/publisher) is a code-first tool
for deploying to
[Posit Connect](https://posit.co/products/enterprise/connect/).

## Installation

Install Posit Publisher by using the Install button above, or using the
Extensions side bar in [Positron](https://github.com/posit-dev/positron) or
[VS Code](https://code.visualstudio.com/) and searching for `posit.publisher`.

Posit Publisher is available from the
[Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Posit.publisher)
or from the [Open VSX Registry](https://open-vsx.org/extension/posit/publisher).

## Features

### Code-First Deployment

Configure your project and then deploy your content to Posit Connect with a
click.

[Configuration files](https://github.com/posit-dev/publisher/blob/main/docs/configuration.md)
allow setting up how you want your content to look and run on Connect - from
choosing a title and description to
[Runtime process settings](https://docs.posit.co/connect/user/content-settings/#content-runtime).

Keep your content stable with language and tool versions set in your
configurations- all automatically detected based on your local environment.

Everything is saved under `.posit/` in your project directory for easy
re-deployment and collaboration.

### Seamless Collaboration

Share your deployments and configurations with your team by committing the
`.posit/` directory to your version control system, allowing Collaborators to
easily pick up where you left off.

### Track all Deployments for a Project

Separate staging and production deployments easily per project.

### Deployment Logs

Logs are organized to easily identify what went wrong.

<img
  src="https://camo.githubusercontent.com/a74aa7b8bc2d2a67508b51764757b4692dea2bb451a8f5f8e876d00e4125a09e/68747470733a2f2f63646e2e706f7369742e636f2f7075626c69736865722f6173736574732f696d672f6465706c6f796d656e742d6c6f67732d76696577322e706e67"
  alt="Deploying Logs with organized steps in the Posit Publisher Logs view"
/>

## Help and Feedback

Documentation can be found in the
[open source repository](https://github.com/posit-dev/publisher/blob/main/docs/index.md).

Report bugs or request features using
[GitHub Issues](https://github.com/posit-dev/publisher/issues).

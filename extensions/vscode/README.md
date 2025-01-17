# Posit Publisher - Deploy to Posit Connect

[Posit Publisher](https://github.com/posit-dev/publisher) is a code-first tool
with a push-button user interface for deploying the things you build in Python
and R to [Posit Connect](https://posit.co/products/enterprise/connect/).

Supported frameworks or content type include:

- Python content: APIs, applications, and notebooks
- R content: Shiny apps, RMarkdown, Plumber APIs, and Rmd with embedded
  Shiny apps
- Quarto content: `.qmd` and `.Rmd` files. Support for embedded Shiny apps

## Installation

Install Posit Publisher using the **Install** button above, or using the
**Extensions** side bar in [Positron](https://github.com/posit-dev/positron) or
[VS Code](https://code.visualstudio.com/) and searching for `posit.publisher`.

Posit Publisher is available from the
[Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Posit.publisher)
or from the [Open VSX Registry](https://open-vsx.org/extension/posit/publisher).

## Features

### Start in VS Code or Positron and end with content on Posit Connect

Posit Publisher extends VS Code and Positron so you can stay in your development
environment to configure and deploy your content. Select the file you want
to deploy, and Posit Publisher will get you started with a configuration.

Once you are ready, deploy your content to Posit Connect.

![Deploying content to Posit Connect using the Posit Publisher extension in VS Code](https://cdn.posit.co/publisher/assets/img/vscode-to-connect.gif)

### Code-first deployment

Configure your content with ease.

[Configuration files](https://github.com/posit-dev/publisher/blob/main/docs/configuration.md)
allow setting up how you want your content to look and run on Connect — from
choosing a title and description to
[Runtime process settings](https://docs.posit.co/connect/user/content-settings/#content-runtime).

Keep your content stable with language and tool versions set in your
configurations — all automatically detected based on your local environment.

Keep your content stable with language and tool versions set in your
configurations — all automatically detected based on your local environment.
And you also have the control to pin them to the exact version that works for
you.

Everything is saved in the `.posit/` directory for easy reproducibility and
collaboration.

### Track all content for a project

If your project requires multiple pieces of content, Posit Publisher can manage
them all inside VS Code or Positron. For example, deploy an API and an
application that utilizes it.

### Associate already deployed content

Posit Publisher isn't only for deploying something new. To start managing your
previously-deployed content in VS Code or Positron, associate your deployment
using just the content's URL.

See the
[Updating Previously Deployed Content](https://github.com/posit-dev/publisher/blob/main/docs/vscode.md#updating-previously-deployed-content)
documentation for more information.

### Seamless collaboration

Collaborate with your team using shared configurations and deployments. Easily
pick up where others left off with deployed content.

See the [Collaboration Workflow](https://github.com/posit-dev/publisher/blob/main/docs/collaboration.md)
documentation for more information.

### Multiple deployments and configurations

Does your content need to be deployed to multiple destinations with different
settings? For example, to a staging environment and production.

Posit Publisher supports managing multiple deployments and configurations,
simplifying the process of deploying to different environments.

### Deployment logs

Logs are organized to easily identify what went wrong.

![Deploying logs with organized steps in the Posit Publisher Logs view](https://cdn.posit.co/publisher/assets/img/deployment-logs.gif)

## Help and feedback

Documentation can be found in the
[open source repository](https://github.com/posit-dev/publisher/blob/main/docs/index.md).

Report bugs or request features using
[GitHub Issues](https://github.com/posit-dev/publisher/issues).

# Posit Publisher - Deploy to Posit Connect and Posit Connect Cloud

[Posit Publisher](https://github.com/posit-dev/publisher) is a code-first tool with a push-button user interface for deploying the data projects you build in Python and R to [Posit Connect](https://posit.co/products/enterprise/connect/) and [Posit Connect Cloud](https://connect.posit.cloud/).

Supported frameworks or content type include:

| Content      | Connect                                                                                                                    | Connect Cloud                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Applications | Shiny, Bokeh, Dash, Gradio, and Streamlit                                                                                  | Shiny, Bokeh, Dash, and Streamlit                      |
| Documents    | Quarto, R Markdown, Parameterized R Markdown, Interactive Quarto and R Markdown, Voilà, Jupyter Notebook, and Static Sites | Quarto, R Markdown, Jupyter Notebook, and Static Sites |
| APIs         | Plumber, Vetiver, FastAPI, Flask, Tableau Analytics Extensions, and TensorFlow Models                                      | -                                                      |
| Other        | Pins and Scripts                                                                                                           | -                                                      |

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

Once you are ready, deploy your content to Posit Connect (as shown in the screenshot below) or Posit Connect Cloud.

![Deploying content to Posit Connect using the Posit Publisher extension in VS Code](https://cdn.posit.co/publisher/assets/img/vscode-to-connect.gif)

### Code-first deployment

Configure your content with ease.

[Configuration files](https://github.com/posit-dev/publisher/blob/main/docs/configuration.md)
allow setting up how you want your content to look and run — from
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
application that utilizes it on Posit Connect.

### Associate already deployed content

Posit Publisher isn't only for deploying something new. To start managing your
previously-deployed content in VS Code or Positron, associate your deployment
using just the content's URL. Note: This is only supported for Posit Connect, not
Posit Connect Cloud.

See the
[Updating Previously Deployed Content](https://github.com/posit-dev/publisher/blob/main/docs/vscode.md#updating-previously-deployed-content)
documentation for more information.

### Seamless collaboration

Collaborate with your team using shared configurations and deployments. Easily
pick up where others left off with deployed content.

See [Collaborative Publishing with Posit Publisher](https://github.com/posit-dev/publisher/blob/main/docs/collaboration.md)
for more information.

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

# Collaborative Publishing with Posit Publisher

[Posit Publisher](https://github.com/posit-dev/publisher)—the extension to
publish content to Posit Connect using
[Visual Studio Code](https://code.visualstudio.com/) and
[Positron](https://positron.posit.co/)—enables seemless collaboration. This
workflow guide shows how to collaborate with others on a piece of content.

## Initial setup

To ensure that others can collaborate without issue the deployment and
configuration files should be available.

That means including them in the repository for the project or including them
in the `files` attribute in the configuration so they are available in the
content bundle.

When Posit Publisher creates a configuration it has the deployment and
configuration files included for deployment.

The inclusions are in the `files` list and look like:

- `/.posit/publish/deployments/deployment-58A3.toml` for the deployment file
- `/.posit/publish/content-title-061E.toml` for the configuration file

The inclusion of the deployment and configuration files allows others to easily
collaborate when they use the Source Version content bundle as a starting point.

## As a collaborator

### Start from a repository

Clone the repo

### Start from a content bundle

Download the Source Version content bundle. If .posit files are included.

They are included by default

See the
[Posit Connect User Guide - Source Versions](https://docs.posit.co/connect/user/source-versions/)
documentation for more information on how to download the content bundle.

Callout note about how this only includes deployed files.

### First time deploying

If the deployment is pointed to a server that you have not deployed to before,
you may need to setup your credentials.

Posit Publisher makes this easy by prompting you to _Create a new Credential_
when the selected deployment requires a credential you don't have.

TODO: SCREENSHOT

## While collaborating

While collaborating on a piece of content, stay updated with the latest changes
others have made.

To do so, pull down the latest changes from the repository or download the
content bundle from the latest Source Version on Posit Conect.

Doing so ensures that you have the most up-to-date content, but also
configuration settings and deployment details.

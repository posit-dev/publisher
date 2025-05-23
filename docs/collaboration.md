# Collaborative Publishing with Posit Publisher

This workflow guide explains how to collaborate with others on deployed content.

## Configuration and Deployment files

Posit Publisher creates two `.toml` files for deploying content.
Both are in the `.posit/publish` directory, found alongside your entrypoint
file.

- The Configuration file describes how the content will be deployed to Posit
  Connect. It can be edited by hand and by interacting with the Posit
  Publisher sidebar. It is named using the content's title and a unique
  identifier, for example, `content-title-061E.toml`. See the
  [Configuration file reference](./configuration.md) for a full list of
  settings.
- The Deployment file details where the content was deployed and its state.
  Deployment files are automatically generated by Posit Publisher in the
  `deployment` directory and updated during deploys. They are not meant to be
  edited. Posit Publisher will take care of this file for you so you do not need
  to think about it aside from the collaboration tips below.

Utilizing both of these files you and your collaborators can update and
configure the same content. To grant others collaborator access to content see
[Posit Connect User Guide - Access list settings](https://docs.posit.co/connect/user/content-settings/#set-collaborators).

## With source control

Configuration and Deployment files found in `./posit/publish` are intended
to be committed into source repositories.

Once tracked in source control, anyone with access can easily collaborate on the
same content.

After a deploy, be sure to commit any changes to the Configuration and
Deployment files. Keeping them in sync with the content on Posit Connect ensures
that collaborators have the most up-to-date details to continue where others
left off.

## Without source control

Include the Deployment and Configuration files in your deployment and others can
use them to collaborate by downloading the files from Posit Connect. Posit
Publisher includes both files by default.

Whenever content is deployed to Posit Connect, a content bundle is created
containing the files. Ensure files you would like collaborators to have access
to are in the [Configuration's Project `files`](./vscode.md#project-files).

See
[Posit Connect User Guide - Source Versions](https://docs.posit.co/connect/user/source-versions/)
for more information on the content bundle source versions and
how to download them.

## Tips

### Stay updated while collaborating

Depending on whether or not you're using source control, make sure to either
pull down the latest changes from source control or download the
content bundle from the latest Source Version on Posit Connect before deploying.
This ensures that you have the most up-to-date content, configuration settings,
and deployment details.

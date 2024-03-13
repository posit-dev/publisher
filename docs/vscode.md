# VSCode Extension

## Quick Start

Install the extension.
[https://cdn.posit.co/publisher/releases/tags/v0.0.alpha3/publisher-0.0.alpha3.vsix](https://cdn.posit.co/publisher/releases/tags/v0.0.alpha3/publisher-0.0.alpha3.vsix).

To learn how to install a `.vsix` file, see the [*Install from a VSIX*](https://code.visualstudio.com/docs/editor/extension-marketplace#_install-from-a-vsix) guide from Visual Studio Code.

## Tutorial

### Opening the UI

In VSCode, open the folder containing the project you want to deploy. In this version of *Posit Publisher*, the project must be in the top level directory.

Open the *Posit Publisher* UI by clicking the icon in the left activity bar.

![](https://cdn.posit.co/publisher/assets/img/icon.png)

### Configuration Files

To publish content, your project must have a publishing configuration file. If you don't have one yet, the UI will show the option to create one.

![](https://cdn.posit.co/publisher/assets/img/initialize-project.png)

Click the `Initialize Project` button to create a configuration file based on the contents of your project files. You'll be prompted to name the configuration, and if there is more than one possible configuration detected, you'll be prompted to choose which one to use.

![](https://cdn.posit.co/publisher/assets/img/choose-configuration.png)

The configuration name will appear in the Configurations panel on the left. You can click to open it, or right click for additional options.

![](https://cdn.posit.co/publisher/assets/img/configurations.png)

The new configuration file will also be opened so you can review and make any necessary changes. If you have the Even Better TOML extension installed, VSCode will show tooltips for the fields. It will also validate the structure and contents of the configuration file using the provided schema.

![](https://cdn.posit.co/publisher/assets/img/configuration-file-with-tooltip.png)

You can have multiple configuration files for different deployments; for example, staging and production. Use the `+` button in the Configurations panel to add a new configuration.

### Python Requirements

The Requirements panel shows the contents of the `requirements.txt` file in your project directory. It's required when deploying a Python project.

![](https://cdn.posit.co/publisher/assets/img/requirements.png)

If you don't have a `requirements.txt` file yet, you'll see a message prompting you to Scan. Clicking Scan will scan your project code for imports and attempt to map those to package names and versions using the package metadata from your local Python installation. After scanning, verify the contents of the generated `requirements.txt` file and make any changes needed.

If you already have a `requirements.txt` file, you can use the eye icon in the Requirements panel to scan your code again.

### Deployments

Once you have configuration and requirements files, you are ready to deploy. Click the `Add` button in the Deployments panel to create a new deployment.

![](https://cdn.posit.co/publisher/assets/img/add-deployment.png)

You'll be prompted for several pieces of information:
* A name for the deployment, which will appear in the Deployments panel.
* A credential to use during deployment, if you have more than one credential defined.
* A Yes/No choice asking whether you want to deploy now, or wait until later. For now, click Yes.
* A choice of which configuration to use, if you answered Yes to deploy now and have more than one configuration defined.

If you open the bottom panel in VSCode and click Posit Publisher Logs, you'll see the deployment logs:
![](https://cdn.posit.co/publisher/assets/img/deployment-logs.png)


Deployments appear in the Deployment panel. The icon indicates whether the content has been successfully deployed.

Not deployed yet:
![](https://cdn.posit.co/publisher/assets/img/add-deployment.png)

Deployed:
![](https://cdn.posit.co/publisher/assets/img/deployment.png)

Error:
![](https://cdn.posit.co/publisher/assets/img/deployment-error.png)

Clicking the deploy icon next to a deployment will deploy a new version of the content, using your current project and configuration files.

## More Features

### Credentials

In the current release, *Posit Publisher* acquires credentials from the RStudio IDE/rsconnect package and rsconnect-python. These are shown in the Credentials panel. To add or remove account credentials, use rsconnect or rsconnect-python.

![](https://cdn.posit.co/publisher/assets/img/credentials.png)

### Files and Exclusions

The Deployment Files panel shows a list of the files in your project directory, divided into two lists:
* Included Files shows the files that will be included in your deployment and sent to the server as part of the uploaded content. You can exclude a file by clicking the icon to the right of the filename.
* Excluded Files shows the files in your project that will not be included in the deployment. The tooltip on an excluded file will indicate the reason it was excluded.

Exclusions are managed through a `.positignore` file in the root directory of your project. It is in the same format as a [`.gitignore` file](https://git-scm.com/docs/gitignore); however, negated patterns are not yet supported.

Note: the extension UI does not currently support re-including an excluded file (removing the exclusion from .positignore) since it might be the result of a wildcard or directory name match. Click the Edit button to open `.positignore` and edit or remove the pattern.

### Help and Feedback

This panel contains links to this documentation and other resources.

## Extension Configuration

### `posit.publisher.executable.path`

By default, the extension uses the bundled Posit Publisher binary executable. To override this behavior, configure the `posit.publisher.executable.path` property in your *User* or *Workspace* settings.

![](https://cdn.posit.co/publisher/assets/img/settings.png)

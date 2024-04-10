# VSCode Extension

## Tutorial

### Opening the UI

In VSCode, open the folder containing the project you want to deploy. In this version of _Posit Publisher_, the project must be in the top level directory.

Open the _Posit Publisher_ UI by clicking the icon in the activity bar.

![](https://cdn.posit.co/publisher/assets/img/icon.png)

### Initialization

To deploy, the following must be created:

- a credential
- a deployment
- a configuration

A credential is a way to authenticate with the server you will deploy to.

A deployment describes where your project is going to be deployed.

A configuration describes how it will be deployed.

If you don't already have a credential, you'll be prompted to set one up.
See the [Credentials](#credentials) section for more information.

![](https://cdn.posit.co/publisher/assets/img/init-credentials.png)

If the project hasn't been initailzed as a Posit Publisher project yet, the extension will prompt you to initialize it.

![](https://cdn.posit.co/publisher/assets/img/initialize-project.png)

Click the `Initialize `Project button, and you will be led through the creation and configuration of your first deployment.

If the extension detects more than one project type, you will be prompted to choose which one to use for your initial configuration.

![](https://cdn.posit.co/publisher/assets/img/choose-configuration.png)

The new configuration file will also be opened so you can review and make any necessary changes.

> [!TIP]
> If you have the [Even Better TOML extension](https://marketplace.visualstudio.com/items?itemName=tamasfe.even-better-toml)
> installed, VSCode will show tooltips for the fields. It will also validate the
> structure and contents of the configuration file using the provided schema.

![](https://cdn.posit.co/publisher/assets/img/configuration-file-with-tooltip.png)

> [!TIP]
> You can have multiple configuration files for different deployments; for
> example, staging and production.
>
> Configurations can be created either in the Home view or the Configuration view
> by pressing the `+` buttons.

### Home

From here you will be taken to the Home view.

![](https://cdn.posit.co/publisher/assets/img/home-view.png)

The Home view shows information about your currently selected deployment. After initialization, you will only have one.

The `>` button next to `Deploy Your Project` can be pressed to expand the view to show deployment, configuration, and credentials selections. In addition, the buttons `+` can be used to create new ones and edit your selection in the case of configurations.

![](https://cdn.posit.co/publisher/assets/img/home-view-expanded.png)

### Basic and Advanced Mode

The buttons at the top-right of the Home view allow you to switch between Basic and Advanced modes, which will change the visible views.

By default, you will be seeing the Basic mode with the views

- Home
- Deployment Files
- Requirements
- Help and Feedback

Clicking the "Show Advanced Mode" button will show the views

- Home
- Deployments
- Configurations
- Credentials
- Help and Feedback

### Setting up Requirements

Finally, to be ready to deploy, you must set up the requirements for your Python project. If you don't already have a `requirements.txt` you can open
the Requirements view and click the `Scan` button to generate one.

![](https://cdn.posit.co/publisher/assets/img/requirements-view-init.png)

### Ready to Deploy

You are all set to Deploy!

Click the `Deploy Your Project` button in the Home view to start the deployment
process. :tada:

---

### Other Views and Features

### Deployment Files

The Deployment Files view shows a list of the files in your project directory,
divided into two lists:

- Included Files show the files that will be included in your deployment and
  sent to the server as part of the uploaded content. You can exclude a file by
  clicking the icon to the right of the filename.
- Excluded Files shows the files in your project that will not be included in
  the deployment. The tooltip on an excluded file will indicate the reason it
  was excluded.

Exclusions are managed through a `.positignore` file in the root directory of
your project. It is in the same format as a [`.gitignore` file](https://git-scm.com/docs/gitignore)

![](https://cdn.posit.co/publisher/assets/img/deployment-files-view.png)

> [!NOTE]
> Note: the extension UI does not currently support re-including an excluded file
> (removing the exclusion from .positignore) since it might be the result of a
> wildcard or directory name match. Click the Edit button to open `.positignore`
> and edit or remove the pattern.

### Requirements

The Requirements view shows the contents of the `requirements.txt` file in your
project directory. It's required when deploying a Python project.

![](https://cdn.posit.co/publisher/assets/img/requirements.png)

If you don't have a `requirements.txt` file yet, you'll see a message prompting you to scan it. Clicking Scan will scan your project code for imports and attempt to map those to package names and versions using the package metadata from your local Python installation. After scanning, verify the contents of the generated `requirements.txt` file and make any changes needed.

If you already have a `requirements.txt` file, you can scan your code again using the eye icon in the Requirements view.

### Deployments

Deployments for the project appear in the Deployment view. The icon indicates
whether the content has been successfully deployed.

Not deployed yet:

![](https://cdn.posit.co/publisher/assets/img/pre-deployment.png)

Deployed:

![](https://cdn.posit.co/publisher/assets/img/deployment.png)

Failure Publishing:

![](https://cdn.posit.co/publisher/assets/img/deployment-publish-error.png)

Error parsing Deployment:

![](https://cdn.posit.co/publisher/assets/img/deployment-error.png)

Click the deploy icon next to a deployment, which will prompt you for your credentials and the configuration you want to use - if you have more than one.

### Configurations

Lists the configurations in your project.

Clicking a configuration will open the configuration file in the editor.
Additionally, you can right-click on a configuration for more operations

- Clone
- Rename
- Delete

![](https://cdn.posit.co/publisher/assets/img/configurations.png)

### Credentials

In the current release, _Posit Publisher_ acquires credentials from the RStudio
IDE/rsconnect package and rsconnect-python. Additionally, if the environment
variables `CONNECT_SERVER` and `CONNECT_API_KEY` are set, an additional
credential named `env` will be created.

These are shown in the Credentials view. To add or remove account credentials,
use rsconnect or
[rsconnect-python](https://docs.posit.co/rsconnect-python/#remembering-server-information).

![](https://cdn.posit.co/publisher/assets/img/credentials.png)

### Help and Feedback

Contains links to this documentation and other resources.

### Posit Publisher Logs

The Posit Publisher logs are available in the VSCode bottom panel.

![](https://cdn.posit.co/publisher/assets/img/deployment-logs.png)

There are a few ways to easily get to them:

- Run `Posit Publisher Logs: Focus on Logs View` from the command palette.
- Click the `Show Logs` button in the error notification that appears on a
  deployment failure.

## Extension Configuration

### `posit.publisher.executable.path`

By default, the extension uses the bundled Posit Publisher binary executable. To
override this behavior, configure the `posit.publisher.executable.path` property
in your _User_ or _Workspace_ settings.

![](https://cdn.posit.co/publisher/assets/img/settings.png)

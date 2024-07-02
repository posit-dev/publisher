# VSCode Extension

## Tutorial

### Opening the UI

In VSCode, open the folder containing the project you want to deploy. In this version of _Posit Publisher_, the project must be in the top level directory.

Open the _Posit Publisher_ UI by clicking the icon in the activity bar.

![](https://cdn.posit.co/publisher/assets/img/icon.png)

### Home

The Home view shows information about the selected deployment destination.

To create your first deployment, click the Add Deployment button.

![](https://cdn.posit.co/publisher/assets/img/no-deployments.png)

This will take you through the process of creating a new deployment,
which includes a credential, configuration, and content record.

- A credential defines the server you will deploy to and the API key that will be used to authenticate you. Once you have created a credential, you can use it for all of your deployments to that server.
- A configuration file describes how your project will be deployed. If the extension detects more than one possible project type, you will be asked which one to use when creating the configuration file.
- A content record describes where your project is going to be deployed, and records the settings used for that deployment and the result.

> [!TIP]
> If you have the [Even Better TOML extension](https://marketplace.visualstudio.com/items?itemName=tamasfe.even-better-toml)
> installed, VSCode will show tooltips for the fields. It will also validate the
> structure and contents of the configuration file using the provided schema.

![](https://cdn.posit.co/publisher/assets/img/configuration-file-tooltip.png)

### Setting up Python Requirements

Before you can deploy a Python project, you must set up the requirements file
for your project. If you don't already have a `requirements.txt` you can open
the Requirements view and click the `Scan` button to generate one. Review
the generated requirements file to ensure it includes all the packages your
project needs.

![](https://cdn.posit.co/publisher/assets/img/python-packages-scan.png)

### R Packages

For R projects, you need an `renv.lock` file that captures the R package dependencies
for your project. You also need an active `renv` library with those packages installed
so the extension can gather details about them.

If you don't have an `renv.lock` file, you can open the R Packages view and click the
`Scan` button to generate one using `renv::snapshot()`.

![](https://cdn.posit.co/publisher/assets/img/r-packages-scan.png)

### Ready to Deploy

You are all set to Deploy!

Click the `Deploy Your Project` button in the Home view to start the deployment
process. :tada:

![](https://cdn.posit.co/publisher/assets/img/deploy-your-project2.png)

During deployment, the extension will show a progress window with the status of the deployment.
Once the deployment completes, the result will be displayed in the Home view.

![](https://cdn.posit.co/publisher/assets/img/deployment-successful2.png)

---

### Other Views and Features

### Multiple Deployments

You can create multiple deployments for different purposes.
For example, you can use a staging deployment for testing before creating
or updating a production deployment that is shared with your users.

Clicking the `Deployment` dropdown lets you choose which deployment to target.

![](https://cdn.posit.co/publisher/assets/img/deploy-your-project2.png)

Then choose from the displayed list.

![](https://cdn.posit.co/publisher/assets/img/select-deployment.png)

### Project Files

This view shows the files in your project directory,
divided into two lists:

- Included Files show the files that will be included in your deployment and
  sent to the server as part of the uploaded content. You can exclude a file by
  clicking the icon to the right of the filename.
- Excluded Files shows the files in your project that will not be included in
  the deployment. The tooltip on an excluded file will indicate the reason it
  was excluded. Some files are excluded by the publisher and cannot be added.
  Files that you have excluded will have an icon to the right of
  the filename that you can click to include the file in the deployment.

![](https://cdn.posit.co/publisher/assets/img/project-files-view.png)

The files included in your project are controlled by the `files` list in
the deployment configuration file. The buttons in the UI update that list.
If you have more than one destination with different configuration files,
they can have different sets of included and excluded files.

The `files` list accepts wildcards in [`.gitignore` format](https://git-scm.com/docs/gitignore).
For example, to include all Python source files from your project directory, you can use
`*.py`. Exclude files (or wildcard patterns) by prefixing them with `!`. If a file
matches multiple entries, the last match wins. For example, you can exclude all
CSV files except `data.csv` with the configuration entry:

```toml
files = [
  "*",
  "!*.csv",
  "data.csv"
]
```

### Python Packages

This view shows the contents of the requirements file in your
project directory. It's required when deploying a Python project.
By default, the filename is `requirements.txt`. You can specify an alternate
name in the deployment configuration file using the `package_file`
field under the `[python]` section.

![](https://cdn.posit.co/publisher/assets/img/python-packages.png)

If you don't have a requirements file yet, you'll see a message prompting you to scan it. Clicking Scan will scan your project code for imports and attempt to map those to package names and versions using the package metadata from your local Python installation. After scanning, verify the contents of the generated requirements file and make any changes needed.

If you already have a requirements file, you can scan your code again using the eye icon in the Requirements view.

### R Packages

This view shows the contents of the `renv.lock` file in your project directory.
It's required when deploying an R project. By default, the filename is `renv.lock`.
You can specify an alternate name in the deployment configuration file using the
`package_file` field under the `[r]` section.

![](https://cdn.posit.co/publisher/assets/img/r-packages.png)

If your `renv.lock` file and library are out of sync, run `renv::snapshot()`
or `renv::restore()` to update the lockfile or library, respectively. Clicking
the "eye" icon in the R Packages view will run `renv::snapshot()` for you.

### Deployments

This view lists the deployments for the project. The icon indicates
whether the content has been successfully deployed.

![](https://cdn.posit.co/publisher/assets/img/deployment-icons.png)

### Configurations

This view lists the configurations in your project.

Clicking a configuration will open the configuration file in the editor.
Additionally, you can right-click on a configuration for more operations

- Clone
- Rename
- Delete

![](https://cdn.posit.co/publisher/assets/img/configurations.png)

### Credentials

This view lists the credentials you have defined.
You need a credential for each Connect server you want to deploy to;
each credential includes the server URL and an API key.
Credentials are securely stored in the OS keychain.

To add a credential for a new server, click the `+` button.
To remove a credential, right-click on it and select `Delete`.

![](https://cdn.posit.co/publisher/assets/img/credentials2.png)

For instructions on how to create a Connect API key, see the
[Connect documentation](https://docs.posit.co/connect/user/api-keys/index.html#api-keys-creating).

### Help and Feedback

This view contains links to this documentation and other resources.

### Posit Publisher Logs

The Posit Publisher logs are available in the VSCode bottom panel.

![](https://cdn.posit.co/publisher/assets/img/deployment-logs-view2.png)

There are a few ways to easily get to them:

- Run `Posit Publisher Logs: Focus on Logs View` from the command palette.
- Click the `Show Logs` button in the error notification that appears on a
  deployment failure.
- Select `Go to Publishing Log` in the status area ellipsis menu.

### Other Logs

Clicking the ellipsis menu in the status area provides options to view
additional options which may be helpful when troubleshooting.

![](https://cdn.posit.co/publisher/assets/img/status-menu.png)

- `Browse Deployment Server` opens a browser window showing the content list on the Connect server.
- `Show Content Log` opens a browser window showing the most recent log for your content on the Connect server.
- `Go to Debug Log` opens the Posit Publisher debug logs in the VSCode output panel.
- `Go to Publishing Log` opens the Posit Publisher Logs panel.

When you open the Posit Publisher UI from VSCode/Positron or the command line,
you first land on the the **Project** page. This page shows the deployments you
have made from this project directory, along with the configuration files, and a
list of your project files.

<p><img width="400px" src="https://cdn.posit.co/publisher/docs/images/ui-project.png"/></p>

Notes:
* The current release of Posit Publisher only supports a single configuration
  file (`default.toml`).
* You can exclude files from the deployment by creating a `.positignore` file.
  It's like a `.gitignore` file and can occur anywhere in your project directory
  or a sub-directory, and can contain wildcards. The file list grays out ignored
  files and provides details if you hover over them.

Click the **+** above **Add a New Deployment** to make a new deployment of your
project. Choose an account/server and give the deployment a name. You can have
more than one deployment. For example, `staging` and `production`.

<p><img width="400px" src="https://cdn.posit.co/publisher/docs/images/ui-new-deployment.png"/></p>

Next, you'll get a chance to review everything before you deploy: the target
server, contents of the configuration file, and files to be deployed.

<p><img width="400px" src="https://cdn.posit.co/publisher/docs/images/ui-pre-deployment.png"/></p>

Click **Deploy**.

You can see the progress of your deployment:

<p><img width="400px" src="https://cdn.posit.co/publisher/docs/images/ui-deploying.png"/></p>


Click the **View summarized deployment logs** link to see a more detailed view:

<p><img width="400px" src="https://cdn.posit.co/publisher/docs/images/ui-summarized-logs.png"/></p>

Click a section heading, such as **Restore Python Environment**, to see a more
detailed view:

<p><img width="400px" src="https://cdn.posit.co/publisher/docs/images/ui-summarized-logs-expanded.png"/></p>

Click the **Project** link at the top of the page to return to the starting
page. Your new deployment is there:

<p><img width="400px" src="https://cdn.posit.co/publisher/docs/images/ui-project-deployed.png"/></p>

Click the deployment to see details and or to re-deploy, which applies any
updates you've made to your project source code or configuration file.
Configuration changes since your last deployment are highlighted:

<p><img width="400px" src="https://cdn.posit.co/publisher/docs/images/ui-redeploy-diff.png"/></p>

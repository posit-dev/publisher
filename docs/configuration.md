# Configuration File Reference

## General settings

#### type

Indicates the type of content being deployed. Valid values are:

- `html`
- `jupyter-notebook`
- `jupyter-voila`
- `python-bokeh`
- `python-dash`
- `python-fastapi`
- `pyhon-flask`
- `python-shiny`
- `python-streamlit`
- `quarto-shiny`
- `quarto`
- `r-plumber`
- `r-shiny`
- `rmd-shiny`
- `rmd`

#### entrypoint

Name of the primary file containing the content. For Python flask, dash, fastapi, and python-shiny projects, this specifies the object within the
file in module:object format. See the documentation at https://docs.posit.co/connect/user/publishing-cli-apps/#publishing-rsconnect-python-entrypoint.

#### title

Title for this content. If specified, it must be a single line containing between 3 and 1000 characters.

#### description

Description for this content. It may span multiple lines and be up to 4000 characters.

#### files

Project-relative paths of the files to be included in the deployment. Wildcards are accepted, using [`.gitignore` syntax](https://git-scm.com/docs/gitignore).

#### has_parameters

`true` if this is a report that accepts parameters.

#### validate

Access the content after deploying, to validate that it is live. Defaults to `true`.

#### $schema

URL of the json-schema definition for this file. Must be 'https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json'. TOML editing tools may use this to provide validation and/or autocomplete.

Example:

```toml
"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "quarto"
entrypoint = "report.qmd"
title = "Regional Quarterly Sales Report"
description = "This is the quarterly sales report, broken down by region."
validate = true

files = [
    "*.py",
    "*.qmd",
    "requirements.txt",
]
```

## Environment

Environment variable/value map. All values must be strings. Secrets such as API keys or tokens should not be stored here.

Example:

```toml
[environment]
API_URL = "https://example.com/api"
```

## Python settings

#### package_file

File containing package dependencies. The file must exist and be listed under 'files'. The default is 'requirements.txt'.

#### package_manager

Package manager that will install the dependencies. Supported values are `pip` and `none`. If package-manager is `none`, dependencies will not be installed.

#### version

Python version. The server must have a matching Python major/minor version in order to run the content.

Example:

```toml
[python]
version = "3.11.3"
package_file = "requirements.txt"
package_manager = "pip"
```

## R settings

#### package_file

File containing package dependencies. This is usually `renv.lock`. The file must exist and be listed under 'files'.

#### package_manager

Package manager that will install the dependencies. Supported values are `renv` and `none`. If package-manager is `none`, dependencies will be assumed to be pre-installed on the server.

#### version

R version. The server will use the nearest R version to run the content.

Example:

```toml
[r]
version = "4.3.1"
package_file = "renv.lock"
package_manager = "renv"
```

## Quarto settings

#### engines

List of Quarto engines required for this content.

#### version

Quarto version. The server must have a similar Quarto version in order to run the content.

```toml
[quarto]
version = "1.4.554"
engines = ["knitr"]
```

## Connect-specific settings

### Access settings

#### run_as

The system username under which the content should be run. Must be an existing user in the allowed group. You must be an administrator to set this value.

#### run_as_current_user

For application content types, run a separate process under the user account of each visiting user under that user's server account. Requires PAM authentication on the Posit Connect server. You must be an administrator to set this value.

Example:

```toml
[connect.access]
run_as = "myuser"
run_as_current_user = true
```

### Kubernetes settings

Settings used with Posit Connect's off-host execution feature, where content is run in Kubernetes.";

#### amd_gpu_limit

The number of AMD GPUs that will be allocated by Kubernetes to run this content.

#### cpu_limit

The maximum amount of compute power this content will be allowed to consume when executing or rendering, expressed in CPU Units, where 1.0 unit is equivalent to 1 physical or virtual core. Fractional values are allowed. If the process tries to use more CPU than allowed, it will be throttled.

#### cpu_request

The minimum amount of compute power this content needs when executing virtual core. Fractional values are allowed.

#### default_image_name

Name of the target container image.

#### default_py_environment_management

Enables or disables Python environment management. When false, Posit Connect will not install Python packages and instead assume that all required packages are present in the container image.

#### default_r_environment_management

Enables or disables R environment management. When false, Posit Connect will not install R packages and instead assume that all required packages are present in the container image.

#### memory_limit

The maximum amount of RAM this content will be allowed to consume when executing or rendering, expressed in bytes. If the process tries to use more memory than allowed, it will be terminated

#### memory_request

The minimum amount of RAM this content needs when executing or rendering, expressed in bytes.

#### nvidia_gpu_limit

The number of NVIDIA GPUs that will be allocated by Kubernetes to run this content.

#### service_account_name

The name of the Kubernetes service account that is used to run this content. It must adhere to Kubernetes service account naming rules. You must be an administrator to set this value.

Example:

```toml
[connect.kubernetes]
amd_gpu_limit = 0
cpu_limit = 1.5
cpu_request = 0.5
default_image_name = "posit/connect-runtime-python3.11-r4.3"
default_py_environment_management = true
default_r_environment_management = true
memory_limit = 100000000
memory_request = 20000000
nvidia_gpu_limit = 1
service_account_name = "posit-connect-content"
```

### Runtime settings

Runtime settings for application content types

#### connection_timeout

Maximum number of seconds allowed without data sent or received across a client connection. A value of `0` means connections will never time-out (not recommended).

#### idle_timeout

The maximum number of seconds a worker process for an interactive application to remain alive after it goes idle (no active connections).

#### init_timeout

The maximum number of seconds allowed for an interactive application to start. Posit Connect must be able to connect to a newly launched application before this threshold has elapsed.

#### load_factor

Controls how aggressively new processes are spawned. The valid range is between 0.0 and 1.0.

#### max_conns_per_process

Specifies the maximum number of client connections allowed to an individual process. Incoming connections which will exceed this limit are routed to a new process or rejected.

#### max_processes

Specifies the total number of concurrent processes allowed for a single interactive application.

#### min_processes

Specifies the minimum number of concurrent processes allowed for a single interactive application.

#### read_timeout

Maximum number of seconds allowed without data received from a client connection. A value of `0` means a lack of client (browser) interaction never causes the connection to close.

Example:

```toml
[connect.runtime]
connection_timeout = 5
idle_timeout = 120
init_timeout = 60
load_factor = 0.5
max_conns_per_process = 50
max_processes = 5
min_processes = 1
read_timeout = 30
```

# Troubleshooting Posit Publisher

This document contains some common issues and solutions for Posit Publisher.

## The Configuration has a schema error

If deploying results in the following error:

> Failed to deploy. The Configuration has a schema error

This occurs when there is a problem with the Deployment's Configuration file.
This can occur due to a missing field, an incorrect value, or even a typo.

Using an extension like [Even Better TOML](https://marketplace.visualstudio.com/items?itemName=tamasfe.even-better-toml)
can help catch problems in the Configuration by providing syntax highlighting,
completion, and hover text using the schema provided by Posit Publisher.

Carefully check your Configuration file for any errors, and refer to the
[Configuration File reference documentation](https://github.com/posit-dev/publisher/blob/main/docs/configuration.md)
for more details on the fields and values that are expected.

## Unrecognized app mode

If when deploying you see the following error:

> Cannot process manifest: Unrecognized app mode

there are few things to check.

### Using `type = 'unknown'`

If your Configuration file contains `type = 'unknown'`, either from the
generated Configuration being unable to identify the type of your content, or
if it was set to the `unknown` type manually, you will see this error.

The Posit Publisher extension view will show an alert when this occurs, asking
for the framework you are using to be set using the `type` field in your
Configuration.

To fix this you will need to find and set the `type` in your Configuration file.
Supported types can be found in the [Configuration File Reference documentation](https://github.com/posit-dev/publisher/blob/main/docs/configuration.md#type).

### Using a `type` that is not supported by your server

Another possibility is Posit Connect, on the server you are deploying to, is
older than the version that introduced support for the `type` set in your
configuration file.

For example, in [Posit Connect 2024.12.0](https://docs.posit.co/connect/news/#posit-connect-2024.12.0-new)
Gradio app support was introduced. When deploying a Gradio app to a server
running an older version of Posit Connect than 2024.12.0, it will error.

## Still having trouble?

If you're still having trouble with Posit Publisher or have any questions,
please reach out to us using a new
[GitHub discussion](https://github.com/posit-dev/publisher/discussions).

If you think you've found a bug or have a feature request,
please open a
[GitHub Issue](https://github.com/posit-dev/publisher/issues).
# Troubleshooting Posit Publisher

This document contains some common issues and solutions for Posit Publisher.

### Unrecongized app mode

If when deploying you see the following error:

> Cannot process manifest: Unrecognized app mode

It is likely due to Posit Connect, on the server you are deploying to, being
older than the version that introduced support for the `type` set in your
configuration file.

For example, in [Posit Connect 2024.12.0](https://docs.posit.co/connect/news/#posit-connect-2024.12.0-new)
Gradio app support was introduced. When deploying a Gradio app to a server
running an older version of Posit Connect than 2024.12.0, the error
above is seen.

## Still having trouble?

If you're still having trouble with Posit Publisher or have any questions,
please reach out to us using a new
[GitHub discussion](https://github.com/posit-dev/publisher/discussions).

If you think you've found a bug or have a feature request,
please open a
[GitHub Issue](https://github.com/posit-dev/publisher/issues).

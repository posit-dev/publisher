# Contributing

## Development

### Build Tools

The build tooling entrypoint is `just`. See the [installation instructions](https://just.systems/man/en/chapter_4.html) for your operating system to install Just.

Execute `just -l` for a list of avaiable commands and documentation.

### Environment Variables

When executing commands the following variables are accepted to change behavior.

| Variable | Default | Type | Description                                                                                              |
|----------|---------|------|----------------------------------------------------------------------------------------------------------|
| CI       | false   | bool | Enable CI mode.   When set to true, multi-platform builds are enabled.                                   |
| DEBUG    | false   | bool | Enable DEBUG mode.   When set to true, `set +x` is enabled for all Justfile targets.                     |
| DOCKER   | false   | bool | Enable DOCKER mode.  When set to true, all Justfile targets are executed in Docker.                      |
| MODE     | dev     | enum | When set to `dev`, development is enabled. All other values disable development mode.                    |


#### Continous Integration in GitHub Actions

When running in GitHub Actions, the env varabile `CI` is set to `true` by GitHub. When `CI=true`, the defaults for the following values are adjusted.

This mode can be reproduced on your local machine by setting `CI=true`.

| Variable | Default |
|----------|---------|
| DOCKER   | true    |
| MODE     | prod    |

### Extension Development

Extensions require the executable to exist on your `$PATH`.

Execute `eval "$(just configure)"` to configure the executable on your current `$PATH`.

## Release

To start a release create a semver compatible tag.

_For this example, we will use the tag `v0.0.dev0`. This tag already exists, so you will not be able run the following commands verbatim._


**Step 1**

Create a proper SemVer compatible tag. Consult the [SemVer specification](https://semver.org/spec/v2.0.0.html) if you are unsure what this means.

`git tag v0.0.dev0`

**Step 2**

Push the tag GitHub.

`git push origin v0.0.dev0`

This command will trigger the [Release GitHub Action](https://github.com/rstudio/publishing-client/actions/workflows/release.yaml).

**Step 3**

Once complete the action has completed, the release will be available on the [Releases page](https://github.com/rstudio/publishing-client/releases).

### Pre-Releases

Any tags denoted as a pre-release as defined by the [SemVer 2.0.0](https://semver.org/spec/v2.0.0.html) specification will be marked as such in GitHub. For example, the `v0.0.dev0` is a pre-release. Tag `v0.0.0` is a standard-release. Please consult the specification for additional information.

[PEP-440](https://peps.python.org/pep-0440/#summary-of-permitted-suffixes-and-relative-ordering) provides a good example of common pre-release tag combinations.

For additional definitions see https://en.wikipedia.org/wiki/Software_release_life_cycle.

Currently, the following suffix lineage is in use:

## Release Lifecycle

### Key

- `X`: The major version.
- `Y`: The minor version.
- `Z`: The patch version.
- `N`: A variable representing the incremental version value.

**`X.Y.devN`**

A development pre-release. Created to test changes to the release procces. `N` starts at **0** and increments by 1 (`X.Y.dev0`, `X.Y.dev1`, ..., `X.Y.devN`).

*https://peps.python.org/pep-0440/#implicit-development-release-number*

**`X.Y.alphaN`**

An alpha pre-release. Created to support internal user testing. `N` starts at **1** and increments by 1 (`X.Y.alpha1`, `X.Y.alpha2`, ..., `X.Y.alphaN`).

*https://peps.python.org/pep-0440/#pre-releases*

**`X.Y.betaN`**

An beta pre-release. Created to support closed external user testing. `N` starts at **1** and increments by 1 (`X.Y.beta1`, `X.Y.beta2`, ..., `X.Y.betaN`).

*https://peps.python.org/pep-0440/#pre-releases*


**`X.Y.rcN`**

An release-candidate pre-release. Created to support open external user testing. `N` starts at **1** and increments by 1 (`X.Y.rc1`, `X.Y.rc2`, ..., `X.Y.rcN`).

*https://peps.python.org/pep-0440/#pre-releases*

**`X.Y.N`**

A stable patch release. Created for backward compatible bug fixes. `N` starts at **0** and increments by 1 (`X.Y.0`, `X.Y.1`, ..., `X.Y.N`).

*https://semver.org*

**`X.N.Z`**

A stable minor release. Created for added functionality in a backward compatible manner. `N` starts at **0** and increments by 1 (`X.0.Z`, `X.1.Z`, ..., `X.N.Z`).

*https://semver.org*

**`N.Y.Z`**

A stable major release. Created for incompatbile API changes. `N` starts at **0** and increments by 1 (`0.Y.Z`, `1.Y.Z`, ..., `N.Y.Z`).

*https://semver.org*

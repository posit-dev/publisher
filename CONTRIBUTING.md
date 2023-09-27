# Contributing

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

**`X.Y.devN`**

A development pre-release. Created to test changes to the release procces. `N` starts at 0 and increments by 1 (`dev0`, `dev1`, ..., `devN`).

*https://peps.python.org/pep-0440/#implicit-development-release-number*

**`X.YalphaN`**

An alpha pre-release. Created to support internal user testing. `N` starts at 1 and increments by 1 (`alpha1`, `alpha2`, ..., `alphaN`).

*https://peps.python.org/pep-0440/#pre-releases*

**`X.YbetaN`**

An beta pre-release. Created to support closed external user testing. `N` starts at 1 and increments by 1 (`beta1`, `beta2`, ..., `betaN`).

*https://peps.python.org/pep-0440/#pre-releases*


**`X.YrcN`**

An release-candidate pre-release. Created to support open external user testing. `N` starts at 1 and increments by 1 (`rc1`, `rc2`, ..., `rcN`).

*https://peps.python.org/pep-0440/#pre-releases*

**`X.Y.N`**

A stable patch release. Created for backward compatible bug fixes. `N` starts at 0 and increments by 1 (`X.Y.0`, `X.Y.1`, ..., `X.Y.N`).

*https://semver.org*

**`X.N.0`**

A stable minor release. Created for added functionality in a backward compatible manner. `N` starts at 0 and increments by 1 (`X.Y.0`, `X.Y.1`, ..., `X.Y.N`).

*https://semver.org*

**`N.0.0`**

A stable major release. Created for incompatbile API changes. `N` starts at 0 and increments by 1 (`X.Y.0`, `X.Y.1`, ..., `X.Y.N`).

*https://semver.org*

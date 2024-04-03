# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Add new Home view with a simplified deployment UI (#1250)
- Show a help message in the Credentials panel if there are no credentials defined (#1186)
- Provide a `Show Logs` button in the deployment failure notification window (#1202)
- Log API accesses in the Output panel to aid in debugging (#1245)
- Support negative matching (patterns beginning with `!`) in positignore files (#420)

### Changed

- Most of the Publisher views now start out collapsed to make room for the Home view (#1196)
- Removed the `Skipping deployment of this project` message if you choose not to deploy (#1268)

### Fixed

- Deploying a configuration with an empty `entrypoint` no longer produces an invalid deployment record (#1212)
- Newly created deployment files (that haven't been deployed yet) no longer include extra fields that are not valid (#1244)
- .positignore paths now match correctly on Windows (#1161)
- Configuration file validation now enforces the presence of the `python` and `quarto` sections for content types that require them (#1159)
- The deployment processs now prevents the section of invalid configuration files (#1135)
- Improved compatibility with `pyenv` projects that use `.python-version` by always ensuring that the current directory is set before inspecting the Python environment (#1080)
- The `deployed-at` field in deployment files updates even if a deployment fails early in the process (#1254)
- Redeploying a content item with a credential from a different server results fails with a message, instead of invalidating the deployment file (#1263)
- Publisher views now load earlier, eliminating a VSCode placeholder that indicated a data provider was not registered (#1090)
- UI text changes based on user feedback (#1230)

### Removed

## [1.0.alpha4]

### Added

- Provide a Visit button in the deployment success notification window (#1173)
- Make the URL in the success log message clickable (#1171)
- Add a Visit button to each deployment in the Deployments list (#1170)

## [1.0.alpha3]

Move the extension from an Editor webview to a using native VSCode views,
navigable via the Activity Bar.
Move functionality that was previously in an Editor webview to views in the
VSCode Primary Sidebar.
Deployment Records and Configurations can now be created, opened, and in the
case of Configurations edited directly via the Extension's views.

### Added

- Include links to documentation and feedback channel (#1140)
- Add comments to deployment records indicating they should not editted by users (#1092)
- Deployment staged logs view in the bottom VSCode panel
- Ability to select a Configuration when deploying

### Changed

- Use relative paths for the configuration `entrypoint` for Quarto projects (#960)

### Fixed

- Fix being unable to ignore subdirectories in `.positignore` (#1117)
- Improve error serialization with errors from Connect or networking (#1074)
- Fixed cases where an unnamed `.toml` deployment record was created (#1076, #1113)

### Removed

- Stand-alone webview opened via an Editor button on files

## [1.0.alpha2]

### Added

- VSCode extension package includes the publisher binary (#737)
- `publisher init` recognizes Quarto projects (jupyter and markdown engines only) (#814)
- `publisher init` recognizes Bottle and Pycnic apps as WSGI/Flask variants (#794)
- `publisher init` creates a .positignore file (#764)
- UI automatically sets light/dark mode based on the selected VSCode theme (#796)
- Deployment details page shows configuration changes since last deployment (#783)
- Deployment history includes the URLs where the deployed content can be accessed (#742), error information if the deployment failed (#747), and the date/time the deployment was created (#639, #836, #839)

### Changed

- Require the user to choose an account, if they have more than one (#636)
- Use CONNECT_SERVER and CONNECT_API_KEY environment variables if they are defined and no account is selected (#722)
- Deployment names in the UI are now case-insensitive (#808)
- Record new deployments immediately, instead of waiting until Deploy is clicked (#773, #775, #776, #777)

### Fixed

- Improve UI navigation, especially when going back or viewing progress/logs (#788, #824)
- Enable copy/paste in the VSCode publisher window (#612)
- Enable command palette in the VSCode publisher window (#633)
- Enable clickable links in the VSCode publisher window (#589, #609, #759)
- Improve messages for TOML parsing/validation errors (#631)

### Removed

- Light/dark mode selection menu when running in VSCode (#804)

## [1.0.alpha1]

Initial release.

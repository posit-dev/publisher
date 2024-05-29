# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.alpha8]

### Added

- There is now an R Packages view in the UI that lists dependencies from your renv.lock file. The Scan button will create or update your renv.lock file by running `renv::snapshot()` (#1657)
- There is now a separate step for `Restoring R Environment` in the Posit Publisher Logs view (#1660)
- Auto-generated configuration files now include a header comment (#1708)
- The documentation now includes a section listing the licenses and attribution for third-party software used in the extension (#1661)
- Snyk scanning is now enabled (#1680)
- The GitHub repository now includes a LICENSE file (#1701)

### Changed

- Destinations are now identified by the `title` field in the configuration file. You'll be prompted for a title when creating a new destination (#1536)
- Deployment and configuration files are automatically named (#1536)
- The Files and Packages sections now start out collapsed (#1629)
- Configurations are now referenced by the relative path (#1653, #1711)

### Fixed

- The renv/staging and renv/sandbox directories are now excluded from deployment (#1627)
- Deploying without the wildcard `*` in the `files` section of the configuration file now includes the correct files (#1647)
- The Python interpreter selected in VSCode/Positron is now used when deploying Python content (#1514)
- Adding a new destination on Windows no longer fails with a 500 error for R projects (#1631)
- Deploying R projects on Linux no longer fails (#1637)
- Disposables are now correctly disposed in the home view improving performance on workspace changes (#1673)

### Removed

- The Deployments detail view no longer includes Add and Redeploy buttons. Use the Destinations view to manage the list of deployment destinations, and to deploy your project (#1696, #1700)

## [1.0.alpha7]

### Added

- Credentials are now managed within the extension. A Connect API key is required. (#1483)
- Credentials must be unique per server URL (#1534)
- R content can now be deployed (#1452). You must have an renv.lock file in your project and have the project's renv library populated (for example via `renv::restore()`).
- Deployment records now include package dependencies that were included in the deployment (#1329)
- Jupyter notebooks can now be deployed in Quarto mode (#963)

### Changed

- Redesigned the main extension UI to simplify the deployment process. Creating a Destination creates a new Deployment target as well as a Configuration. (#1517)
- Changed TOML attributes across files to use `snake_case` (#1377)

### Fixed

- Fixed opening project files on Windows (#1512)

### Removed

- Remove documentation for the `publisher` CLI until the CLI is officially supported (#1561)

## [1.0.alpha6]

### Added

- Configuration files can now include a `files` list to specify which files are included in the deployment (#1350)
- You can now include and exclude files from the Project Files view (#1360)
- The deployment UI remembers the last selection (#1229, #1271)
- Views show progress indicators more accurately when performing actions (#1385)

### Changed

- The Requirements and Project Files view now update based on the selected configuration (#1362)
- Combined the "basic" and "advanced" views into a single, easier to use view (#1336)

### Fixed

- Fixed handling of include/exclude file paths on Windows (#1500)
- Alignment of deployment error messages (#1504)
- Fixed forward / backward navigation and step count in multi-step inputs (#1424)

### Removed

- .positignore files are no longer used to select which files are included in the deployment (#1350)
- Credentials are no longer imported from rsconnect and rsconnect-python (#1539)

## [1.0.alpha5]

### Added

- Add new Home view with a simplified deploy UI (#1250)
- Add new Initialize Project step to prepare the project for deployment (#1270)
- Show a help message in the Credentials panel if there are no credentials defined (#1186)
- Provide a `Show Logs` button in the deployment failure notification window (#1202)
- Log API accesses in the Output panel to aid in debugging (#1245)
- Support negative matching (patterns beginning with `!`) in positignore files (#420)

### Changed

- Most of the Publisher views now start out collapsed to make room for the Home view (#1196)

### Fixed

- Deploying a configuration with an empty `entrypoint` no longer produces an invalid deployment record (#1212)
- Newly created deployment files (that haven't been deployed yet) no longer include extra fields that are not valid (#1244)
- .positignore paths now match correctly on Windows (#1161)
- Configuration file validation now enforces the presence of the `python` and `quarto` sections for content types that require them (#1159)
- The deployment process now prevents the section of invalid configuration files (#1135)
- Improved compatibility with `pyenv` projects that use `.python-version` by always ensuring that the current directory is set before inspecting the Python environment (#1080)
- The `deployed-at`, `configuration-name`, and `configuration` fields in deployment files updates even if a deployment fails early in the process (#1254, #1308)
- Redeploying a content item with a credential from a different server results fails with a message, instead of invalidating the deployment file (#1263)
- Publisher views now load earlier, eliminating a VSCode placeholder that indicated a data provider was not registered (#1090)
- UI text changes based on user feedback (#1230)

### Removed

- Removed the `Skipping deployment of this project` message if you choose not to deploy (#1268)

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

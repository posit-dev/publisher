# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

### Removed

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

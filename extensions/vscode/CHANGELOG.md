# Changelog

All notable changes to the Posit Publisher extension are documented in this
file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.4]

### Added

- Added the support for recursively scanning workspace directories so the
  extension can manage multiple projects at once (#1849)
- Added a publish button to the editor view when an entrypoint is the active
  file to allow for easier deployment of the entrypoint (#1846)
- Added progress bars for asynchronous actions in each of the extension's views
  (#1958)

### Changed

- A loading indicator is now shown in the Home view until all initialization is
  complete (#1960)

### Fixed

- Improved Credential validation by allowing a Connect instance behind a proxy
  (#1974)
- The extension now activates when a workspace is opened with only directories
  (#1991)
- Fixed comments in `requirements.txt` showing up in the Python Packages view
  (#2010)

### Removed

- Deployments and Configurations views were removed from the extension (#1996)

## [1.1.3]

- Initial beta release

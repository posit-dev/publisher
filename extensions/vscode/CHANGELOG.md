# Changelog

All notable changes to the Posit Publisher extension are documented in this
file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.5]

### Added

- Added support detecting the `quarto-shiny` type for Quarto documents that had
  `revealjs` as the output format (#2065)
- Added inspection support for Jupyter notebooks using Quarto Inspect allowing
  Jupyter notebooks to be published using Quarto (#2059, #2085)
- Added an overlay that disables the extension's Home view when a selection is
  being made (#1995)
- Added support for setting a Credential using a dotfile (#2088)
- Added the ability to dismiss the current deployment in progress (#2057)
- Added sorting of entrypoints when adding a new deployment including open files
  at the top of the list (#2045)

### Changed

- The Posit Publisher button in the editor view for entrypoints now does not
  deploy after a new deployment is created - giving users time to review the
  newly created configuration before deploying (#2060)
- Changed the scanning of entrypoints when adding a new deployment - now a
  cursory scan is done using file extensions and a full inspection is only done
  on the selected entrypoint greatly improving the speed of adding a new
  deployment (#2029)
- Changed the initial listing of entrypoints, when adding a new deployment, to
  only show unique options rather duplications for each content type (#2046)
- Changed the Posit Publisher icon (#2054)
- The Posit Publisher icon is now bundled as an icon-font to support SVGs for
  better rendering on high DPI displays (#2054)

### Fixed

- Fixed an issue where include and exclude patterns in configuration `files`
  lists did not correctly handle specified files in subdirectories (#2075)
- Fixed the Python Packages list including a blank entry when whitespace was
  present in the `requirements.txt` file (#2033)
- Fixed an issue where opening a workspace with no files or only files without
  read permissions would cause an unhelpful error when adding a new deployment -
  the error now correctly communicates that no possible entrypoints were found
  (#2032)
- Fixed an issue with entrypoint inspection where a non-PyShiny entrypoint would
  cause other files from being scanned (#2011)
- Fixed anchor links opening new tabs in web based VSCodes including in
  Posit Workbench (#2034)

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

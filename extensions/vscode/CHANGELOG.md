# Changelog

All notable changes to the Posit Publisher extension are documented in this
file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.7]

### Added

- Secrets are now able to be pushed up during a deploy in the added Secrets
  view. Secret names can be added to the Configuration, and values supplied
  individually in the Secrets view. (#2260, #2304, #2305)
- Newly made Deployments can now be associated with previously deployed content
  to easily update content on a Connect server. (#2285)
- Views that require action now show a warning icon when collapsed to assist in
  discovery (#2245)
- Credentials are now persisted on OSes without keychains by storing them in the
  user's home directory under `.connect-credentials`. If using a previous
  version of the extension with a `.connect-credentials` dotfile remove it when
  upgrading. (#1831)
- Files that have previously been deployed that are now deselected for the
  next deployment show a red `R` icon in the Project Files view (#2299)

### Changed

- When creating a new deployment, open entrypoint files are listed with an
  option to use an open file dialog to select any file. This removes a recursive
  search for all entrypoints present within the open workspace. (#2337)
- The entrypoint file is now more prominent in the UI. It is visible in the
  Deployment selection and options when selecting (#2248)
- Changed the editor button tooltip wording for deployable files. It now reads
  "Deploy with Posit Publisher" (#2209)
- The Credentials and Help views are now shown even when no Deployment is
  selected (#2309)
- Changed the naming of generated deployment files to be more unique, similar to
  configuration files. They now include a short unique hash to avoid collisions
  in source control (#1818)

### Fixed

- If editing a configuration file makes the configuration file invalid there are
  no longer refresh file errors (#2323)
- Newly included files in subdirectories are now correctly decorated with a
  green `A` on Windows (#2112)

## [1.1.6]

### Added

- Added a warning message if a package is not installed locally when scanning
  for package requirements (#2113)
- Added a link to edit the configuration file in relevant error messages when we
  fail to deploy (#2047)

### Changed

- Changed Project Files to a tree view making it easier to manage included and
  excluded files and directories (#1210)
- When including and excluding files in the extension Project Files view the
  file path is now included in the configuration files list to avoid including
  similarly named files in subdirectories (#2159)
- The files attribute in configuration files is now printed in a multiline
  format for better readability (#2158)
- The publish button in the editor view for entrypoints no longer automatically
  re-deploys. It will continue to assist in selection of deployments (#2180)
- Moved the "Create a New Deployment" option in Deployment selection menus to
  the top of the list for easier discovery (#2110)
- Changed the naming of generated configuration files to be more unique. They
  are now based on the entered content title and include a short unique hash to
  avoid collisions in source control (#2135)

### Fixed

- When creating a Shiny Express deployment the entrypoint is now included in the
  generated configuration file (#2137)
- Reduced the number of workspace file scanning operations done when a large
  number of files are deleted in the workspace to improve performance (#2107)
- Expensive file scanning operations are now debounced and throttled
  to improve performance and avoid duplicate scans (#1970)
- Improved catching of errors in the extension by ensuring that all errors are
  caught and logged (#1912)
- Fixed an issue where errors would occur if a directory in the workspace was
  prevented from being read (#2210)

### Removed

- Removed the flat file view for Project Files in favor of the tree view
  (#1210, #2160)

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

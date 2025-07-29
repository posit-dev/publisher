# Changelog

All notable changes to the Posit Publisher extension are documented in this
file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added `product_type` field to the config schema. (#2729)

## [1.18.1]

### Fixed

- Updated software components used by Posit Publisher to address CVE-2025-7783
  (#2741)

## [1.18.0]

### Fixed

- Fixed the naming of "Shiny for Python" and "Shiny for R" content types. (#2664)
- Fixed an issue where end-to-end tests could not run on some Mac systems due to Docker files not being built for the correct platform.
- Fixed an issue where disabling keychain credential storage would not work as expected. (#2697)
- Fixed inconsistent runtime discovery and selection at deploy time. (#2648)

### Added

- Improved support for Posit Connect deployments hosted in Snowpark Container
  Services. (#2687, #2691)

### Changed

- Bumped the credential version to 2 to support Posit Connect Cloud credentials. (#2684)

## [1.16.1]

### Fixed

- A filepath quoting issue on Windows when using R with a `.bat` file extension.
  (#2637)
- Detect and report auth client errors at deploy time. (#2654)

## [1.16.0]

### Added

- Added support for deploying to Connect in Snowflake using key-pair auth. (#2632)

## [1.14.0]

### Added

- Introduced detection of required R interpreter version based on
  `DESCRIPTION` file and `renv.lock` file. The detected version
  will fill the `requires_r` field in configuration (#2636)

### Fixed

- Detection of required python interpreter version now will request a compatible
  version when there is `.python-version` file declaring a specific version number
  without any version requirement operator (#2628)
- Fixed an issue where scanning for Python dependencies created an `renv.lock` file.
  Now the dependencies file is properly named `requirements.txt`. (#2639)

## [1.12.1]

### Fixed

- Fix missing platform build in OpenVSX due to outage.

## [1.12.0]

### Added

- Added the ability to update the target GUID for a deployment at any time
  from the "..." menu. (#2576)
- Added a new extension setting `Use Key Chain Credential Storage`
  (defaulting to true), allowing the user to prioritize the use
  of a credential file over the keyring. (#2519)
- Credentials are now exposed via a `posit-connect` authentication provider,
  which is surfaced within the native Accounts UI. (#2608)
- Added a new extension setting `Default Connect Server` to pre-populate
  the Server URL when creating a credential if there is not already one
  configured. When running within Posit Workbench, the extension will use the
  URL from the [default RStudio/Posit Workbench setting](https://docs.posit.co/ide/server-pro/rstudio_pro_sessions/rstudio_connect_server.html) (rstudio-pro#7466)
- When expanded, the Python Packages view will now display a message describing
  how to configure the project to use Python if the configuration file does not
  indicate a dependency on Python. (#2571)
- Added a new field to the Python configuration section ("requires_python"),
  which can be used to indicate the range of Python interpreter versions
  required to run the content on the Connect server. If it is not provided,
  it is populated from the project files ".python-version", "pyproject.toml" and
  "setup.cfg". This setting is inserted into the manifest during
  deployment. (#2617)

### Fixed

- Publisher icon was sometimes missing when workpace folder starts out
  untrusted in VS Code. The extension now supports running within both untrusted and
  trusted workspaces, and will prompt to manage workspace trust so it can initialize. (#2611)

### Changed

- R, Python, and Quarto versions are now optional in configuration files and
  will not be populated when creating a new deployment. If not present at the
  time of deployment, versions will be discovered and inserted from user's
  running environment. (#2468, #2470)
- The `posit-publishing-schema-v3` configuration file schema has been updated
  with the new "Python.requires_python" field as well as the switch from required to
  optional for the version field within the R, Python and Quarto sections.
- The Publisher Log Panel has now been renamed to "Publisher" and now will
  stay hidden until the user initiates a deployment operation from within the
  extension. It remains visible until the VSCode window is restarted. (#2596)

## [1.10.0]

### Added

- Added a new [Troubleshooting document](https://github.com/posit-dev/publisher/blob/main/docs/troubleshooting.md)
  and a link to it in error notifications that occur during deployment. (#2562)
- Added a new [Collaboration document](https://github.com/posit-dev/publisher/blob/main/docs/collaboration.md)
  describing how to collaborate on projects using the Posit Publisher. (#2383)
- Added support for deploying Gradio content to Posit Connect. (#2476, #2477)
- Inspection for Gradio entrypoint files was added to correctly determine when
  it is Gradio content and setting `type = 'python-gradio'` in the generated
  configuration file. (#2475)
- When deploying R content without a `lockfile` the extension now prompts the
  user to install and setup `renv` then creates a `renv.lock` depending on what
  is needed in their environment. (#2560)
- The Python interpreter used is now consistent across the extension and
  uses the selected Python intrepter in Positron or the
  [VS Code Python extension](https://marketplace.visualstudio.com/items?itemName=ms-python.python)
  defaulting to the Python on PATH when none is selected. (#2494, #2496)
- A warning has been added to the sidebar when the selected deployment has a
  configuration with `type = 'unknown'` suggesting the framework be set. (#2515)
- Icons have been added to the deployment select dropdown to indicate the
  deployment's server and entrypoint. (#2483)

### Fixed

- Deployment dismissal has been greatly improved. Deployments are no longer
  updated as the deploy continues on Posit Connect. They instead will be set to
  the dismissed state, avoiding changes after dismissal. (#2179, #2498)
- Fixed an issue where the "View Content" button could appear when a deployment
  failed prior to any content being created on Posit Connect. (#2373)

### Changed

- The Python and R package files can no longer be un-checked in the Project
  Files view to avoid unintended removal from the `files` attribute in the
  configuration. (#2555)
- The sidebar design was unified to have similar different vertical placement in
  various deployment states. (#2531)
- Warnings in the sidebar have a new look to optimize horizontal space, utilize
  theme colors, and emphasize links. (#2526, #2527)
- The error when the extension could not validate credentials has been improved
  to indicate that connectivity to the server could also be a problem. (#2450)

## [1.8.0]

### Added

- The selected R interpreter in Positron is preferred over an R interpreter on
  PATH when inspecting an entrypoint. When a deployment is created the selected
  R version is used in the generated configuration where applicable. (#2500)

### Fixed

- When utilizing file-based credential storage and the file is using an older
  format, or has been corrupted, the file is backed up and the user is prompted
  to re-enter their credentials. (#2491)
- If corrupted credentials are detected inside of keychain storage the store
  will be reset and the user will be prompted to re-enter their credentials.
  (#2492)

### Changed

- The entrypoint can no longer be un-checked in the Project Files view to avoid
  unintended removal from the `files` attribute in the configuration. (#2487)
- The sidebar design has changed slightly to emphasize the deployment selection.
  (#2480, #2481)
- The deployment selection field in the sidebar now uses a right chevron to
  indicate dropdown will appear as a VS Code Quick Pick. (#2482)

## [1.6.0]

### Added

- Added emphasis to the entrypoint file for the selected deployment in the
  Project Files view (#2239)
- When running the extension in Positron the selected R interpreter is now used
  rather than using the R interpreter from the PATH (#1968)
- Added improved inspection for RMarkdown sites. When a `_site.yml` or
  `_bookdown.yml` file present the content category is correctly set to `site`.
  (#1643)
- Added improved inspection and initial configurations for Quarto Websites when
  a `_quarto.yml` is present. Pre and post scripts are now automatically
  included in the initial configuration. (#2266)

### Fixed

- Fixed the extension sidebar freezing when a deployment with a large number of
  files is selected (#2204)

## [1.4.0]

### Changed

- Changed the behavior when the configuration has `type = 'unknown'`. Now
  several actions can be performed such as including/excluding files via
  the sidebar and re-deploying to Posit Connect if the content type was deployed
  with the unknown type. (#2419)
- Changed the `quarto` type to `quarto-static` to match Posit Connect. The
  type `quarto` has been deprecated, and it is recommended to use
  `quarto-static`. (#1208)

### Added

- Added support for deploying Quarto script files (#1208)
- Improved the Secrets view in the sidebar to show when the secret is already
  set for the content on Posit Connect, when a value is going to be set on
  deploy, and when a value needs to be set (#2365)
- Added the ability to hide all input cells or hide input cells with the
  `hide_input` metadata tag in Jupyter notebooks using a new section in
  configuration files (#2399)

### Fixed

- Fixed an issue with new deployments with the unknown type (due to inspection)
  causing errors and not creating all necessary files (#2419)
- Fixed unknown inspection occassionally not including the selected entrypoint
  in the generated configuration's files list (#2419)
- Fixed a behavior causing `renv.lock` related errors to show in the Posit
  Publisher output channel and a vague "Could not scan..." message being
  shown. Now the specific errors are displayed for easier resolution. (#2408)
- Replaced an unhelpful error with a much more informative message when
  attempting to inspect a Python file and a Python executable can not be found
  to do the inspection (#2385)

## [1.2.1]

### Changed

- Updated extension README.md to include an outline of the features provided and links to the documentation and issue board.

## [1.2.0]

### Added

- Improved documentation around the file inclusion, git ignore pattern used in
  configuration files (#2359)
- Selecting a configuration file with errors no longer disables the deploy
  button. Instead, errors are displayed during the deployment process to better
  indicate what needs to be addressed (#2345, #2374)
- Added a line number to the configuration file error message to better indicate
  where the schema validation error is occurring (#2330)
- Added a more informative error when the Content ID is not found on the
  Connect server when updating an existing deployment (#2287)
- Added more logging to the extension output to help diagnose issues (#2153)
- Added an option to disable certificate verification when communicating with a
  Connect server (#2202)
- Added a helpful warning when the selected configuration file has overlapping
  secrets and environment variable names to avoid unexpected behavior (#2326)
- Added helpful errors when attempting to deploy with a missing package file, or
  a package file with no content (#2177, #2327)
- Added a helpful error when attempting to deploy to locked content (#2375)
- Added a fast failure when attempting to deploy to an existing target on
  Connect with a different content type (#2301)
- Added automatic inclusion of deployment's configuration and content record
  files (#2370)

### Changed

- Changed the icon for setting Secret values in the Secrets view to be more
  clear that a value is being set (#2379)
- Changed the prompt for setting a name for a Connect server and the related
  credential to be more clear (#2265)
- Changed the "couldn't access the deployed content" error to be more clear
  and link to the content's logs directly (#2206)
- Changed URL validation when adding a Connect server credential to allow for
  URLs with paths (#2001)
- Changed URL validation to automatically discover the proper Connect server
  API endpoint based on the URL provided by the user (often incorrect) (#2001)
- Changed unexpected errors to be briefer, with additional details being sent
  to the VSCode's Output/Window pane
- Removed the Scan button from the R Packages view and updated the message to
  include a link to the `renv` documentation when the R package file is missing,
  invalid or empty (#2403)

### Fixed

- Fixed an issue where the R version was going undetected when `R_HOME` is set
  (#2343)
- Fixed the deployment selection prompting users to select "one of
  the existing deployments below" when no deployments were listed (#2241)
- Fixed an issue where after scanning for R packages or Python packages the
  file would not correctly open in the editor (#2328)
- Fixed an issue with file watching that would show an error when hitting a
  symlink pointing to a missing file (#2267)

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

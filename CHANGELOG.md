# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- For Connect: the input for referencing a previous deployment is once again more lax in
  its validation: So long as there is a GUID in the string, it will be attempted. This
  means that one can use the in-app URL, the standalone URL, or simply the GUID again. (#3341)

## [1.26.0]

### Added

- Added support for deploying Holoviz Panel applications with the `python-panel` content type.

### Fixed

- When creating a Connect credential using token authentication or an API key
  the server URL is automatically discovered even when extra paths are provided
  (e.g., `/connect`). (#2999)
- Fixed text and button alignment in webview (#3071)
- When a deployment configuration content type isn't recognized as a known type,
  the resulting type in the manifest is no longer an empty string (#2542)

### Added

- Added support for deploying Quarto Shiny content to Connect Cloud (#3265)

## [1.24.0]

### Added

- Added more prominent status messages when rendering Quarto documents. (#2940)
- Improved visuals for waiting on Connect on-prem token to be claimed (#2900)
- Added automatic discovery of static assets for Quarto projects (#2594)
- Added LLM tooling for LLM assistants to be able to help out with deployment failures and configuration errors(#2690)
- Added detection support for Plumber2 projects. (#3150)

### Fixed

- The "R Packages" section no longer shows you an alert if you aren't using renv. (#3095)
- When `renv.lock` contains packages installed from GitHub or Bitbucket the deploy
  process should respect `RemoteHost`, `RemoteRepo`, `RemoteUsername` and
  `RemoteUrl` and `RemoteSubdir` fields (#3147)
- When a package has a present `RemoteSubdir`, the field `GithubSubdir` is added too
  to avoid issues with previous versions of Packrat not considering `RemoteSubdir` for
  packages hosted in Github. (#3194)
- Projects referencing packages with RemoteRepos by name and not URL do not hang when deploying. (#3209)

# Changed

- When opening the full deployment log record, it opens as a new unsaved file. (#2996)

## [1.22.0]

### Added

- Added "Set Up renv" button to initialize the environment, install
  dependencies, and create a lockfile when no valid R lockfile file is present (#3000, #3048)
- Added support for managing OAuth integration content requirements directly from the "Integration Requests" pane in the Publisher UI. Auto-association of OAuth integrations is supported when deploying to Posit Connect 2025.09.0 or later with a license that includes OAuth integrations. (#3016)
- Added a "Render Your Project" button that shows up for HTML project deployments
  rendered by Quarto to easily update and publish the rendered output (#2948)
- Added support for Positron repositories configuration when detecting dependencies,
  allowing dependencies to be installed with the configured CRAN repository.

### Fixed

- Fixed an issue where the preferred Python path was incorrectly not found when deploying (#2742)
- Fixed Python dependencies scanning not respecting the active Python session (#2825)
- Fixed messaging about setting up renv (#3029)

### Changed

- Update installation.md to include directions for Positron, pre-release, and Open VSX installations (#3066)
- Remove install-publisher.bash script and references (#3066)

## [1.21.0]

### Added

- Added the configuration TOML file code to the displayed deployment name (#3018)
- Added the ability to toggle between the summary view (tree) and the raw view (text)
  for the Publisher logs along with copy and save logs functionality (#3017)

## [1.20.0]

### Fixed

- Fixed an issue deploying content to free Posit Connect Cloud accounts with incorrect
  access settings. (#3005)

## [1.19.1]

### Fixed

- Fixed the Python and R Packages views incorrectly stating the default package
  files were missing even when they were present (#2882, #2884)
- Fixed an issue where the package file checkbox in the Project Files view
  would occasionally be unchecked even when the file was included (#2793)

### Added

- Added UTM parameters for Connect Cloud links to see who is coming from
  Publisher (#2969)
- R dependencies are automatically detected when a project does not include an
  `renv.lock` file.
- Added a celebratory message when credential token is connected (#2901)

### Changed

- R manifest package generation now uses only `renv.lock` file by default. To use the
  local `renv` library instead, set `r.packages_from_library = true` in the
  configuration.
- Setting `python.package_manager=pip` will now force pip as the package manager
  enven when the server default is `uv`.

## [1.19.0]

### Fixed

- Fixed the "Posit Publisher: View Deployment Logs in Connect" incorrectly being
  available in the Command Palette (#2899)

### Added

- Added script to always enable the PCC flag for publisher e2e tests prior to running
- Added staging.json config for test user details and ability to retrieve from AWS and GH secrets (CI)
- Added Cypress E2E Test for PCC Oauth and credential adding
- Added repeat-cypress-headless.sh script for easily repeating e2e tests
- Added Cypress E2E CI Setup and Test Reliability Improvements (#2721)
- Added endpoints for performing OAuth Device Authorization Grant with Posit Cloud login. (#2692)
- Added support for one-click token authentication with Connect. (#2769)
- Added schema and agent support for publishing to Connect Cloud. (#2729, #2747, #2771)
- Added colors to the logs indicating queued, skipped, passed, and errored log
  stage statuses. (#2382)
- Improved error messaging when deployment fails due to a schema validation error. (#2831)
- Added a Copy System Info command and item in the "Help and Feedback" view to
  easily copy system information - extension version, IDE, and platform details
  (#2835)
- Added a delete button for Credentials in the Credentials View (#2862)
- When opened, the Publisher logs scroll to and expand the first failed stage
  if a stage is marked as failed (#2857, #2858)
- Added a configuration option that will auto open Publisher logs on a failed deploy (#2860)
- Use server hostname as the default credential name for new Connect credentials
  (#2922)
- Introduced Posit Connect Cloud support. This feature allows publishing to Connect Cloud.

### Changed

- The "Select Deployment" input can now be dismissed by focusing another element
  similar to other inputs. (#2780)
- Publish failure logs and deployment validation failure logs link to the logs
  view directly in Posit Connect and Posit Connect Cloud when available (#2859)
- If the agent process crashes or is killed, the extension will now restart it. (#2961)

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
- Added internal API endpoint to list Connect Cloud accounts. (#2695)

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

### Changed

- Updated `record.toml` to correspond with updated schema change in v1.12

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
- End-to-end tests environment refactored (#2508, #2588 & #2589 - Project)
- Legacy CLI code removed (#2521 - Project)

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
- Added attributes to the Files API responses if all nested files are included
  or excluded based on the configuration (#2147)

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

### Added

- Added links to marketplaces in extension README (#1899)

### Changed

- Split extension publishing CI in to two separate jobs to facilitate reruns (#1898)

## [1.1.2]

### Fixed

- Fixed VSIX target OS and architecture (#1895)

## [1.1.1]

### Fixed

- Fixed the release tooling for publishing the VSCode extension (#1893)

## [1.1.0]

### Added

- Added a [VSCode Walkthrough](https://code.visualstudio.com/api/ux-guidelines/walkthroughs)
  for the extension (#1834)
- Added the currently-deploying Deployment's title to the Posit Publisher Logs
  view for more clarity (#1756)
- Added a confirmation prompt when deleting a Credential (#1733)
- Added a "Get Package Descriptions" deploying stage to the Posit Publisher Logs
  view for R projects (#1593)
- Added a link to the GitHub Discussions for the project in the help and
  feedback view (#1884)
- Added validation for server URLs and API keys when creating Credentials
  (#1610, #1611, #1612)

### Changed

- Generated configuration files now omit `has_parameters` if it is `false`
  (#1788)
- Adjusted the VSCode extension file watcher to send file information to views
  less frequently when large amounts of files are being created or deleted.
  Sending is now debounced. (#1735)
- Rendered files are now excluded by default in generated Configurations for
  Quarto deployments (#1707)
- Moved the settings for the VSCode extension under the "Posit Publisher" title
  (#1869)
- Stopped `.ipynb` from being identified as potential `quarto` projects to avoid
  deploying HTML without executing the code cells (#1863)

### Fixed

- Deployed Posit Connect manifests no longer contain empty option sections if
  they are ommitted in the configuration file (#1823)
- Fixed the "Got To Publishing Log" link in the last deployment message
  context menu (#1889)

### Removed

- Removed the executable path option now that the extension is bundled with the
  publisher binary (#1877)

## [1.0.beta1]

### Added

- Added protection against selecting a configuration of a different type than
  the selected deployment (#1658)
- Added a pre-flight deployment check that verifies the configuration and
  deployment type match (#1666)
- Once deployments are deployed and have GUIDs a content type is recorded in the
  deployment record (#1741)
- Added the MIT license to the extension bundle (#1773)
- Added a context menu to the Deployment status section of the sidebar to view
  logs (#1693)

### Changed

- Changed the name "Destination" to "Deployment" to make it more clear what
  was being created and deployed (#1690)
- Changed the order of steps when creating a credential. Now the user is
  prompted to give the server URL, the API key, and then a name (#1751)
- API key input prompts are now using the password type, hiding the input
  (#1775)
- Improved naming of deployment logs stages to make them more clear (#586)
- Improved missing configuration error message - now prompts the user to
  select or create a configuration based on available configurations (#1752)
- Deployments and Configurations views are no hidden by default on initial
  install of the extension (#1697)

### Fixed

- The extension no longer gets stuck on "Scanning folder..." on VSCode version
  `1.90.0` (#1803)
- Fixed extension commands for the Files, Python packages, and R packages views
  that were not registered previously (#1766)
- Removed an outdated message about a `publisher` CLI command from the extension
  (#1781)
- Configurations are no longer created specifying Python for a non-Python
  project even if Python is detected (#1760)
- Python Package scanning now handles notebook blocks without newlines (#1769)

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
- The Python interpreter selected in VSCode is now used when deploying Python content (#1514)
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

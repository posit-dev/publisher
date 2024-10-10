# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
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

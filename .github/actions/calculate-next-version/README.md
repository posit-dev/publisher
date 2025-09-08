# Calculate Next Version

This GitHub Action calculates the next version number based on VSCode extension versioning guidelines.

## Versioning Guidelines

The VSCode extension versioning follows these guidelines:

- **Release versions** use `major.EVEN_NUMBER.patch` (e.g., `1.0.0`, `1.2.0`)
- **Pre-release versions** use `major.ODD_NUMBER.patch` (e.g., `1.1.0`, `1.3.0`)

## Usage

```yaml
- name: Get version tags
  id: get-tags
  uses: ./.github/actions/get-tags
  with:
    ref: main
    pattern: '^v[0-9]+\.[0-9]+\.[0-9]+$'

- name: Calculate version
  id: calculate-version
  uses: ./.github/actions/calculate-next-version
  with:
    release-type: "release" # or 'pre-release'
    all-tags: ${{ steps.get-tags.outputs.all-tags }}
    max-tags: "10" # Optional, defaults to 10
```

## Inputs

| Input          | Description                                                                            | Required | Default       |
| -------------- | -------------------------------------------------------------------------------------- | -------- | ------------- |
| `release-type` | Type of release to generate (must be either "release" or "pre-release")                | Yes      | `pre-release` |
| `all-tags`     | Comma-separated list of all version tags in the repository (from get-tags action)      | Yes      | -             |
| `max-tags`     | Maximum number of recent tags to consider (to avoid issues with older non-SemVer tags) | No       | `10`          |

## Outputs

| Output               | Description                                                |
| -------------------- | ---------------------------------------------------------- |
| `next-version`       | The calculated next version with v prefix (e.g., `v1.5.0`) |
| `current-release`    | The current release version (even minor)                   |
| `current-prerelease` | The current prerelease version (odd minor)                 |
| `latest-version`     | The latest version overall (regardless of type)            |

## Algorithm

1. Processes the provided version tags:
   - Reverses the input list to start with newest tags
   - Takes only the most recent tags up to `max-tags` (default 10)
   - Validates each tag using strict semver rules
   - Fails immediately if any tag is not a valid semantic version
   - Sorts valid tags by semantic version (newest first)
2. Works with the filtered list of valid tags
3. Finds the latest release and pre-release versions
4. Based on the requested release type:
   - For `release`:
     - If latest version has an even minor, increments patch
     - If latest version has an odd minor, switches to next even minor
   - For `pre-release`:
     - If latest version has an even minor, switches to next odd minor
     - If latest version has an odd minor, increments patch
5. Returns the calculated next version and related information

The `max-tags` parameter focuses on recent history:

By limiting to only the most recent tags, the action ensures that version calculations are based on your project's current versioning practices rather than potentially different historical practices.

> **Important Note**: All tags must be valid semantic versions. The action will fail immediately if any tag doesn't comply with semantic versioning rules.

## Requirements

- Node.js 22.x (Current Active LTS version as of September 2025)

> **Note**: GitHub Actions only supports explicit Node.js version specifications (`node20`, `node22`, etc.), not dynamic LTS specifications. We've chosen Node 22 as it's the current Active LTS version.

## Testing

The action includes comprehensive tests that directly test the index.js file:

```bash
npm test
```

These tests:

1. Mock the @actions/core module to capture inputs and outputs
2. Directly import and execute index.js with different test cases
3. Validate the outputs match expected values

Test coverage includes:

1. Version calculation logic for both release and prerelease types
2. Handling tags with or without v prefixes
3. Proper sorting of semver tags
4. Error handling for invalid inputs
5. Real-world version tag scenarios
6. Alpha/beta/development version tags

All tests are designed to run without external dependencies, making them easy to execute locally.

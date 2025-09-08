# Calculate Next Version

This GitHub Action calculates the next version number based on VSCode extension versioning guidelines.

## Versioning Guidelines

The VSCode extension versioning follows these guidelines:

- **Release versions** use `major.EVEN_NUMBER.patch` (e.g., `1.0.0`, `1.2.0`)
- **Pre-release versions** use `major.ODD_NUMBER.patch` (e.g., `1.1.0`, `1.3.0`)

This action uses standard semantic versioning terminology (`major`, `minor`, `patch`, `premajor`, `preminor`, `prepatch`) mapped to VSCode's even/odd versioning scheme:

- **Release types** (`major`, `minor`, `patch`) always produce versions with even minor numbers
- **Prerelease types** (`premajor`, `preminor`, `prepatch`) always produce versions with odd minor numbers

#### Version Calculation Chart

| Current Version | Release Type | Next Version | Description                       |
| --------------- | ------------ | ------------ | --------------------------------- |
| 1.4.0 (stable)  | major        | 2.0.0        | New major release version         |
| 1.4.0 (stable)  | minor        | 1.6.0        | Next even minor release           |
| 1.4.0 (stable)  | patch        | 1.4.1        | Increment patch on stable version |
| 1.4.0 (stable)  | premajor     | 2.1.0        | New major prerelease version      |
| 1.4.0 (stable)  | preminor     | 1.5.0        | Next odd minor prerelease         |
| 1.4.0 (stable)  | prepatch     | 1.5.0        | Move to prerelease state          |
| 1.5.0 (pre)     | major        | 2.0.0        | New major release version         |
| 1.5.0 (pre)     | minor        | 1.6.0        | Next even minor release           |
| 1.5.0 (pre)     | patch        | 1.6.0        | Move to next stable version       |
| 1.5.0 (pre)     | premajor     | 2.1.0        | New major prerelease version      |
| 1.5.0 (pre)     | preminor     | 1.7.0        | Next odd minor prerelease         |
| 1.5.0 (pre)     | prepatch     | 1.5.1        | Increment patch on prerelease     |

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
    release-type: "prepatch" # Options: "major", "minor", "patch", "premajor", "preminor", "prepatch"
    all-tags: ${{ steps.get-tags.outputs.all-tags }}
    max-tags: "10" # Optional, defaults to 10
```

## Inputs

| Input          | Description                                                                                       | Required | Default    |
| -------------- | ------------------------------------------------------------------------------------------------- | -------- | ---------- |
| `release-type` | Semantic version type to increment: `major`, `minor`, `patch`, `premajor`, `preminor`, `prepatch` | Yes      | `prepatch` |
| `all-tags`     | Comma-separated list of all version tags in the repository (from get-tags action)                 | Yes      | -          |
| `max-tags`     | Maximum number of recent tags to consider (to avoid issues with older non-SemVer tags)            | No       | `10`       |

## Outputs

| Output               | Description                                                |
| -------------------- | ---------------------------------------------------------- |
| `next-version`       | The calculated next version with v prefix (e.g., `v1.5.0`) |
| `current-release`    | The current release version (even minor)                   |
| `current-prerelease` | The current prerelease version (odd minor)                 |
| `latest-version`     | The latest version overall (regardless of type)            |

The `max-tags` parameter focuses on recent history:

By limiting to only the most recent tags, the action ensures that version calculations are based on your project's current versioning practices rather than potentially different historical practices.

> **Important Note**: All tags must be valid semantic versions. The action will fail immediately if any tag doesn't comply with semantic versioning rules.

## Requirements

- Node.js 24.x

> **Note**: GitHub Actions only supports explicit Node.js version specifications (`node16`, `node20`, `node24`), not dynamic LTS specifications. We've chosen Node 24 as it's the current Active LTS version that is supported by GitHub Actions.

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

1. Version calculation for all supported types (`major`, `minor`, `patch`, `premajor`, `preminor`, `prepatch`)
2. Testing both stable (even minor) and prerelease (odd minor) starting versions
3. Handling tags with v prefixes
4. Proper sorting of semver tags
5. Error handling for invalid inputs
6. Real-world version tag scenarios

All tests are designed to run without external dependencies, making them easy to execute locally.

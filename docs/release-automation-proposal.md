# Release Process Automation Proposal

## Current Release Process

### Versioning Strategy

The project uses a unique versioning convention:

- **Even minor versions** (1.30.0, 1.32.0) = production releases
- **Odd minor versions** (1.31.x) = pre-releases/nightlies

Version is derived from git tags using `git describe --tags` (see `scripts/get-version.bash`).

### Nightly Pre-releases (Already Automated)

The `nightly-prerelease.yaml` workflow runs daily at 7 AM UTC:

1. Checks if current `main` commit is already tagged
2. Calculates next version:
   - If latest is even minor → bump to next odd minor (e.g., 1.32.0 → 1.33.0)
   - If latest is odd minor → increment patch (e.g., 1.33.0 → 1.33.1)
3. Creates and pushes the tag
4. Tag push triggers `release.yaml` and `publish.yaml` workflows

### Production Releases (Currently Manual)

Current manual steps:

1. **Update CHANGELOGs**
   - Move `[Unreleased]` content under new version header in `CHANGELOG.md`
   - Copy/sync changes to `extensions/vscode/CHANGELOG.md`

2. **Commit changelog updates**
   - Create PR or commit directly to main

3. **Create version tag**
   - `git tag -a v1.32.0 -m "Release v1.32.0"`
   - `git push origin v1.32.0`

4. **Automated workflows triggered by tag**
   - `release.yaml` - builds artifacts and creates GitHub release
   - `publish.yaml` - publishes to VS Code Marketplace and Open VSX

---

## Automation Opportunities

### Option 1: Manual Trigger Release Workflow

Create a `workflow_dispatch` workflow that handles the entire release:

```yaml
name: Create Release
on:
  workflow_dispatch:
    inputs:
      version:
        description: "Version to release (e.g., 1.32.0)"
        required: true
        type: string
      dry-run:
        description: "Dry run (no commits or tags)"
        required: false
        type: boolean
        default: false

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
          token: ${{ secrets.RELEASE_TOKEN }}

      - name: Validate version
        run: |
          # Ensure even minor version for production release
          MINOR=$(echo "${{ inputs.version }}" | cut -d. -f2)
          if [ $((MINOR % 2)) -ne 0 ]; then
            echo "Error: Production releases must have even minor version"
            exit 1
          fi

      - name: Update CHANGELOGs
        run: |
          # Script to move [Unreleased] to [version]
          # and sync to extensions/vscode/CHANGELOG.md
          ./scripts/prepare-release.bash "${{ inputs.version }}"

      - name: Commit and tag
        if: ${{ !inputs.dry-run }}
        run: |
          git config user.name "github-actions"
          git config user.email "github-actions@users.noreply.github.com"
          git add CHANGELOG.md extensions/vscode/CHANGELOG.md
          git commit -m "Release v${{ inputs.version }}"
          git tag -a "v${{ inputs.version }}" -m "Release v${{ inputs.version }}"
          git push origin main "v${{ inputs.version }}"
```

**Pros:**

- Single click to release
- Validates version convention
- Automates changelog updates

**Cons:**

- No PR review before release
- Requires careful version input

---

### Option 2: Release PR Workflow

Create a workflow that opens a PR to prepare the release:

```yaml
name: Prepare Release PR
on:
  workflow_dispatch:
    inputs:
      version:
        description: "Version to release (e.g., 1.32.0)"
        required: true

jobs:
  prepare:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Create release branch
        run: git checkout -b release/v${{ inputs.version }}

      - name: Update CHANGELOGs
        run: ./scripts/prepare-release.bash "${{ inputs.version }}"

      - name: Create PR
        run: |
          git add -A
          git commit -m "Prepare release v${{ inputs.version }}"
          git push -u origin release/v${{ inputs.version }}
          gh pr create \
            --title "Release v${{ inputs.version }}" \
            --body "## Release Checklist\n- [ ] CHANGELOG entries are correct\n- [ ] Version number follows convention"
```

Then add a separate workflow that creates the tag when the PR is merged:

```yaml
name: Tag Release
on:
  pull_request:
    types: [closed]
    branches: [main]

jobs:
  tag:
    if: github.event.pull_request.merged && startsWith(github.event.pull_request.head.ref, 'release/v')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - name: Extract version and create tag
        run: |
          VERSION=${GITHUB_HEAD_REF#release/}
          git tag -a "$VERSION" -m "Release $VERSION"
          git push origin "$VERSION"
```

**Pros:**

- PR provides review opportunity
- Can verify changelog entries before release
- Clear audit trail

**Cons:**

- Two-step process
- More complex workflow setup

---

### Option 3: Hybrid Approach (Recommended)

Combine the best of both:

1. **`/release` Claude skill** - Prepares changelog and creates PR
2. **Merge triggers tag** - When release PR merges, auto-create tag
3. **Manual override** - Keep ability to manually tag for hotfixes

#### Implementation Steps

1. Create `scripts/prepare-release.bash`:
   - Validates version is even minor
   - Updates `CHANGELOG.md` (moves Unreleased → version)
   - Syncs to `extensions/vscode/CHANGELOG.md`
   - Validates changelog has entries

2. Create `.github/workflows/prepare-release.yaml`:
   - Triggered by `workflow_dispatch` with version input
   - Runs prepare script
   - Creates PR with release checklist

3. Create `.github/workflows/tag-on-release-merge.yaml`:
   - Triggered when PR with `release/v*` branch merges
   - Creates and pushes version tag

4. Create `/release` Claude skill:
   - Interactive way to trigger the workflow
   - Can validate changelog entries first

---

## Supporting Scripts Needed

### `scripts/prepare-release.bash`

```bash
#!/usr/bin/env bash
set -euo pipefail

VERSION="$1"

# Validate even minor version
MINOR=$(echo "$VERSION" | cut -d. -f2)
if [ $((MINOR % 2)) -ne 0 ]; then
    echo "Error: Production releases must have even minor version"
    exit 1
fi

# Update root CHANGELOG.md
sed -i "s/## \[Unreleased\]/## [Unreleased]\n\n## [$VERSION]/" CHANGELOG.md

# Sync to VSCode CHANGELOG
# (copy content from root to vscode changelog)
./scripts/sync-changelog.bash

echo "Release v$VERSION prepared"
```

### `scripts/sync-changelog.bash`

Script to sync root CHANGELOG entries to `extensions/vscode/CHANGELOG.md`.

---

## Recommended Next Steps

1. **Implement `scripts/prepare-release.bash`** - Core release preparation logic
2. **Create `prepare-release.yaml` workflow** - GitHub Actions workflow
3. **Create `tag-on-release-merge.yaml` workflow** - Auto-tag on merge
4. **Add `/release` Claude skill** - Easy way to initiate releases
5. **Document the process** - Add RELEASING.md with instructions

---

## Questions to Resolve

1. Should release PRs require specific approvers?
2. Should we add release notes generation from CHANGELOG?
3. Should we validate that all PRs since last release are in CHANGELOG?
4. Should hotfix releases (patch on even minor) follow same process?

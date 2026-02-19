# Release Helper

Help prepare and execute a production release of Posit Publisher.

## Overview

This skill guides you through the release process:

1. Determine the next version number
2. Verify changelog entries are complete
3. Prepare the release (locally or via GitHub workflow)

## Versioning Convention

- **Even minor versions** (1.32.0, 1.34.0) = production releases
- **Odd minor versions** (1.31.x, 1.33.x) = pre-releases/nightlies

Production releases must have an even minor version number.

---

## Step 1: Determine Next Version

1. **Get the latest release version**:

   ```bash
   git fetch --tags
   git tag --sort=-version:refname | grep -E '^v[0-9]+\.[0-9]*[02468]\.[0-9]+$' | head -1
   ```

2. **Calculate next version**:
   - If latest release is `v1.32.x`, next release should be `v1.34.0`
   - Increment the minor version by 2 (to stay even) and reset patch to 0

3. **Confirm with user**: Ask which version they want to release, suggesting the calculated next version.

---

## Step 2: Verify Changelog Entries

Before releasing, ensure the CHANGELOG is complete:

1. **Check for content in [Unreleased]**:

   ```bash
   # Extract content between [Unreleased] and next version header
   awk '/^## \[Unreleased\]/{capture=1; next} /^## \[/{if(capture) exit} capture' CHANGELOG.md
   ```

2. **If empty or sparse**, suggest running `/changelog` to find missing entries.

3. **Review the entries**: Show the user what will be in this release and ask for confirmation.

---

## Step 3: Prepare the Release

Ask the user how they want to proceed:

### Option A: Use GitHub Workflow (Recommended)

Guide them to trigger the workflow:

1. Go to **Actions** → **Prepare Release** → **Run workflow**
2. Enter the version number (e.g., `1.34.0`)
3. The workflow will:
   - Create a `release/v1.34.0` branch
   - Update both CHANGELOG files
   - Open a PR for review

When the PR is merged, the tag is created automatically.

### Option B: Prepare Locally

If they prefer to do it locally:

1. **Run the prepare script**:

   ```bash
   python3 ./scripts/prepare-release.py <version>
   ```

2. **Review changes**:

   ```bash
   git diff CHANGELOG.md extensions/vscode/CHANGELOG.md
   ```

3. **Create branch and commit**:

   ```bash
   git checkout -b release/v<version>
   git add CHANGELOG.md extensions/vscode/CHANGELOG.md
   git commit -m "Prepare release v<version>"
   git push -u origin release/v<version>
   ```

4. **Create PR**:
   ```bash
   gh pr create --title "Release v<version>" --body "Release preparation for v<version>"
   ```

---

## Step 4: After PR Merges

Once the release PR is merged to main:

1. **Tag is created automatically** by the `tag-on-release-merge` workflow
2. **Release workflow triggers** to build and publish:
   - Creates GitHub release with artifacts
   - Publishes to VS Code Marketplace
   - Publishes to Open VSX Registry

---

## Quick Reference

### Manual Tag Creation (Hotfixes Only)

For emergency hotfixes that bypass the normal flow:

```bash
git checkout main
git pull origin main
git tag -a v<version> -m "Release v<version>"
git push origin v<version>
```

### Check Release Status

```bash
# See recent tags
git tag --sort=-version:refname | head -10

# Check if a version is a pre-release
./scripts/is-pre-release.bash  # Returns 'true' for odd minor versions
```

---

## Example Interaction

```
User: /release

Claude: Let me help you prepare a release.

**Current latest release:** v1.32.0
**Suggested next version:** v1.34.0

Would you like to release v1.34.0?

User: yes

Claude: Let me check the changelog entries for this release...

**[Unreleased] section contains:**
- 3 entries in Added
- 2 entries in Fixed
- 1 entry in Changed

These look good. How would you like to proceed?
1. **GitHub Workflow** (Recommended) - I'll guide you to trigger it
2. **Local preparation** - I'll run the scripts here

User: 1

Claude: To trigger the release workflow:
1. Go to: https://github.com/posit-dev/publisher/actions/workflows/prepare-release.yaml
2. Click "Run workflow"
3. Enter version: 1.34.0
4. Click "Run workflow"

This will create a PR with the changelog updates. When merged, the release tag
will be created automatically.
```

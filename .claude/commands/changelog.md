# CHANGELOG Update Helper

Help maintain the CHANGELOG.md by finding missing entries for merged PRs, or write a changelog entry for your current work.

## Mode Selection

Ask the user which mode they need:

1. **Find missing entries** - Scan merged PRs for missing changelog entries
2. **Write entry for current work** - Help draft a changelog entry for the current branch

---

## Mode 1: Find Missing Entries

### Instructions

1. **Find the last release version**: Get the most recent version tag using `git tag --sort=-version:refname | head -1`

2. **Get PRs merged since last release**: List PRs merged after the last release tag:

   ```bash
   gh pr list --repo posit-dev/publisher --state merged --search "merged:>$(git log -1 --format=%ci <last-tag> | cut -d' ' -f1)" --limit 100 --json number,title,mergedAt,labels
   ```

3. **Check for missing entries**: Read the CHANGELOG.md and look for PR numbers in the `[Unreleased]` section. Compare against the merged PRs to find any that are missing.

4. **Categorize PRs**: Based on PR title prefixes and labels:
   - `feat:` or `feature:` → **Added**
   - `fix:` → **Fixed**
   - `chore:`, `ci:`, `docs:`, `test:` → Usually skip (infrastructure changes) unless user-facing
   - `refactor:` → **Changed** (if user-facing)
   - Dependency bumps (`deps`, `deps-dev`) → Usually skip unless notable

5. **Report findings**: Present a summary of:
   - PRs already documented in CHANGELOG
   - PRs missing from CHANGELOG that likely need entries (user-facing changes)
   - PRs that can be skipped (chore/ci/docs/deps)

6. **Suggest entries**: For missing PRs that need documentation, suggest CHANGELOG entries following the existing format:
   - Brief description of the change from a user's perspective
   - PR number in parentheses: `(#1234)`
   - Place under the appropriate section: Added, Changed, Fixed, Deprecated, Removed, or Security

## CHANGELOG Format

The CHANGELOG follows [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
## [Unreleased]

### Added

- New feature description. (#1234)

### Changed

- Change description. (#1235)

### Fixed

- Bug fix description. (#1236)
```

## Example Output

```
## CHANGELOG Analysis

### Already Documented
- #3520: Updated Go from 1.24 to 1.25 ✓

### Missing Entries (Need Documentation)
- #3512: fix: detect entrypoints in custom editors
  Suggested entry (Fixed): Fixed entrypoint detection in custom editors. (#3512)

### Skipped (Infrastructure/Deps)
- #3538: ci: skip tests for docs-only PRs
- #3527: chore(deps-dev): bump eslint from 9.39.2 to 10.0.0
```

---

## Mode 2: Write Entry for Current Work

Help draft a changelog entry for the work on the current branch.

### Instructions

1. **Analyze current branch**: Get branch name and commits since main:

   ```bash
   git rev-parse --abbrev-ref HEAD
   git log main..HEAD --oneline
   ```

2. **Review the changes**: Look at what files were modified:

   ```bash
   git diff main...HEAD --stat
   ```

3. **Read key changed files**: Use the Read tool to understand what the changes actually do. Focus on:
   - Source code changes (not test files or configs)
   - Understanding the user-facing impact

4. **Determine if entry is needed**: Based on categorization rules:
   - `feat:` or `feature:` → **Added** (needs entry)
   - `fix:` → **Fixed** (needs entry)
   - `chore:`, `ci:`, `docs:`, `test:` → Usually skip unless user-facing
   - `refactor:` → **Changed** only if user-facing
   - Dependency bumps → Usually skip unless notable

5. **Draft the entry**: If an entry is warranted:
   - Write from the user's perspective (what they'll notice/benefit from)
   - Use past tense for Fixed, present tense for Added/Changed
   - Keep it concise (one sentence when possible)
   - Include placeholder for PR number: `(#XXXX)`
   - Specify which section it belongs in (Added/Changed/Fixed/etc.)

6. **Offer to add it**: Ask if the user wants you to add the entry to CHANGELOG.md in the `[Unreleased]` section.

### Example Output

```
## Current Branch Analysis

**Branch**: fix/detect-entrypoints-custom-editors
**Commits**: 2 commits ahead of main

### Changes Summary
Modified `internal/inspect/detect.go` to handle custom editor file types
when scanning for entrypoints.

### Changelog Entry Needed: Yes

**Section**: Fixed
**Suggested Entry**:
- Fixed entrypoint detection failing for files opened in custom editors. (#XXXX)

Would you like me to add this entry to the CHANGELOG.md?
```

---

## Notes

- Focus on user-facing changes that affect how people use Posit Publisher
- Keep descriptions concise and written from the user's perspective
- Use past tense for Fixed entries, present tense for Added/Changed
- Multiple related PRs can sometimes be combined into a single entry
- For current work, use `(#XXXX)` as placeholder until PR is created

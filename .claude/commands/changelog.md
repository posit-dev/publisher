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

6. **Analyze missing PRs with subagents**: For each missing PR that likely needs documentation, spawn a subagent using the Task tool with `subagent_type=general-purpose` to analyze the PR in depth. The subagent prompt should:

   ```
   Analyze PR #<number> in posit-dev/publisher and suggest a CHANGELOG entry.

   1. Get PR details including linked issues: `gh pr view <number> --json title,body,files,closingIssuesReferences`
   2. Review the changed files to understand what was actually modified
   3. Determine the user-facing impact of the changes
   4. Categorize: Added, Changed, Fixed, Deprecated, Removed, or Security
   5. Write a concise changelog entry from the user's perspective
   6. IMPORTANT: Reference the linked issue number, not the PR number. If closingIssuesReferences contains an issue, use that number. Only use the PR number if no issue is linked.

   Return in this format:
   - **PR**: #<number> - <title>
   - **Linked Issue**: #<issue-number> (or "None" if no linked issue)
   - **Category**: <Added|Changed|Fixed|etc.>
   - **Suggested Entry**: <one-sentence description from user perspective>. (#<issue-or-pr-number>)
   - **Reasoning**: <brief explanation of why this category and wording>
   ```

   Run subagents in parallel (up to 5 at a time) for efficiency.

7. **Compile suggestions**: Collect all subagent responses and present the suggested entries grouped by category (Added, Changed, Fixed, etc.) so they can be easily added to the CHANGELOG

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

## Reference Convention

**IMPORTANT: Always reference GitHub issue numbers, not PR numbers.**

- Issues represent the user-facing problem or feature request
- Issues are more meaningful to users reading the changelog
- Multiple PRs may address a single issue, so issues are the stable reference
- If analyzing a PR, look up its linked issue(s) using `gh pr view <number> --json closingIssuesReferences`
- If no issue exists for a change, the PR number can be used as a fallback

## Example Output

```
## CHANGELOG Analysis

### Already Documented
- #3396: Fixed credential operations failing silently ✓ (references issue)

### Missing Entries (Analyzing with subagents...)

[Spawning 3 subagents to analyze PRs #3550, #3551, #3552...]

### Subagent Analysis Results

#### Fixed
- Fixed entrypoint detection failing for files opened in custom editors. (#3512)
  *PR #3550 → Linked Issue #3512*
  *Reasoning: The PR modifies detect.go to handle custom editor file types - directly impacts user experience*

- Fixed deployment preview not updating after configuration changes. (#3400)
  *PR #3551 → Linked Issue #3400*
  *Reasoning: Bug fix that was causing stale UI state after config edits*

#### Added
- Added support for deploying Shiny Express applications. (#3480)
  *PR #3552 → Linked Issue #3480*
  *Reasoning: New feature enabling a previously unsupported content type*

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

5. **Find the linked issue**: If a PR already exists for the current branch, check for linked issues:

   ```bash
   gh pr view --json number,closingIssuesReferences
   ```

   Use the linked issue number in the changelog entry. If no issue exists, use the PR number as a fallback.

6. **Draft the entry**: If an entry is warranted:
   - Write from the user's perspective (what they'll notice/benefit from)
   - Use past tense for Fixed, present tense for Added/Changed
   - Keep it concise (one sentence when possible)
   - **Reference the linked issue number**, not the PR number: `(#<issue-number>)`
   - If no issue exists yet, use placeholder `(#XXXX)` and note that an issue should be created or PR number used
   - Specify which section it belongs in (Added/Changed/Fixed/etc.)

7. **Offer to add it**: Ask if the user wants you to add the entry to the root `CHANGELOG.md` file in the `[Unreleased]` section.

### Example Output

```
## Current Branch Analysis

**Branch**: fix/detect-entrypoints-custom-editors
**Commits**: 2 commits ahead of main
**Linked Issue**: #3512 (from PR #3550)

### Changes Summary
Modified `internal/inspect/detect.go` to handle custom editor file types
when scanning for entrypoints.

### Changelog Entry Needed: Yes

**Section**: Fixed
**Suggested Entry**:
- Fixed entrypoint detection failing for files opened in custom editors. (#3512)

Would you like me to add this entry to the CHANGELOG.md?
```

---

## Notes

- Focus on user-facing changes that affect how people use Posit Publisher
- Keep descriptions concise and written from the user's perspective
- Use past tense for Fixed entries, present tense for Added/Changed
- Multiple related PRs can sometimes be combined into a single entry
- For current work, use `(#XXXX)` as placeholder until PR is created

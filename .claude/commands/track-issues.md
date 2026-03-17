# Track Issues

Audit merged PRs against a parent tracking issue's checklist, find gaps, and optionally create missing issues and update the tracking list.

## Arguments

The parent tracking issue number is provided via `$ARGUMENTS`. If empty, ask the user for the parent issue number before proceeding.

---

## Step 1: Read the Parent Issue

Fetch the parent tracking issue and extract its current state.

```bash
gh issue view <ISSUE_NUMBER> --json title,body,labels
```

From the response:

1. **Parse the tracking checklist** — extract all lines matching `- [x] #NNN` or `- [ ] #NNN` (with optional descriptions). Record each issue number and its checked/unchecked status.
2. **Identify the label** — check if the issue has a relevant label (e.g., `ts-migration`). This label will be used to filter PRs and issues in later steps.

Present a brief summary:

```
Parent issue: #NNNN — <title>
Label: <label>
Tracked issues: NN total (NN checked, NN unchecked)
```

---

## Step 2: Find Recent Merged PRs

Find PRs merged since the last release tag that carry the same label as the parent issue.

1. **Get the last release tag date**:

   ```bash
   last_tag=$(git tag --sort=-version:refname | head -1)
   git log -1 --format=%ci "$last_tag" | cut -d' ' -f1
   ```

2. **Fetch merged PRs with the label**:

   ```bash
   gh pr list --repo posit-dev/publisher --state merged --label "<label>" --search "merged:>YYYY-MM-DD" --limit 100 --json number,title,mergedAt,labels
   ```

   If the parent issue has no label, skip the `--label` filter and instead fetch all merged PRs since the last release. In this case, warn the user that results may include unrelated PRs.

Present:

```
Found NN merged PRs with label "<label>" since <tag>
```

---

## Step 3: Audit Each PR for Linked Issues

For each merged PR found in Step 2, check whether it has closing issue references.

```bash
gh pr view <PR_NUMBER> --json number,title,closingIssuesReferences
```

Run these in batches using subagents (up to 5 in parallel) for efficiency. For each PR, record:

- PR number and title
- Linked issue numbers (from `closingIssuesReferences`)
- Whether any linked issue carries the same label as the parent

---

## Step 4: Cross-Reference

Compare the data from Steps 1-3 to identify gaps. Build four lists:

1. **Fully tracked** — PR has a linked issue that appears in the parent's checklist. No action needed.
2. **Linked but unlisted** — PR has a linked issue (with the right label) but that issue is NOT in the parent's checklist. Action: add to checklist.
3. **No linked issue** — PR has no `closingIssuesReferences` at all. Action: create a new issue and add to checklist.
4. **Open labeled issues not in checklist** — search for open issues with the label that aren't in the parent's checklist:

   ```bash
   gh issue list --repo posit-dev/publisher --label "<label>" --state all --json number,title,state --limit 200
   ```

   Filter these against the parent's existing checklist to find any missing.

---

## Step 5: Report Findings

Present a summary table to the user:

```
## Tracking Audit for #NNNN

### Fully Tracked (no action needed)
| PR | Linked Issue | In Checklist |
|----|-------------|-------------|
| #100 | #200 | Yes |

### Linked but Not in Checklist (need to add)
| PR | Linked Issue | Status |
|----|-------------|--------|
| #101 | #201 | open |

### No Linked Issue (need to create)
| PR | Title |
|----|-------|
| #102 | Migrate foo endpoint to TypeScript |

### Labeled Issues Not in Checklist
| Issue | Title | Status |
|-------|-------|--------|
| #203 | Migrate bar to TS | open |

### Summary
- Fully tracked: NN
- Need to add to checklist: NN
- Need new issue: NN
- Labeled issues missing from checklist: NN
```

---

## Step 6: Offer to Fix

Ask the user if they want to proceed with fixes. Present three options:

1. **Create missing issues only** — for PRs with no linked issue
2. **Update parent checklist only** — add missing issues to the tracking list
3. **Both** — create issues and update the checklist

### Creating Issues

For each PR that needs an issue:

1. Create the issue with:
   - Title derived from the PR title (e.g., "Migrate POST /foo from Go to TypeScript")
   - Body referencing the PR: "Completed in #<PR_NUMBER>."
   - The same label as the parent issue

   ```bash
   gh issue create --repo posit-dev/publisher --title "<title>" --body "Completed in #<PR_NUMBER>." --label "<label>"
   ```

2. Immediately close the issue since the work is already done:

   ```bash
   gh issue close <NEW_ISSUE_NUMBER> --repo posit-dev/publisher
   ```

3. Record the new issue number for the checklist update.

### Updating the Parent Checklist

1. Fetch the current parent issue body:

   ```bash
   gh issue view <PARENT_NUMBER> --json body --jq '.body'
   ```

2. Build the updated body by appending missing issues to the checklist. For each missing issue:
   - If the issue is closed, add `- [x] #NNN`
   - If the issue is open, add `- [ ] #NNN`

   Insert new entries at the end of the existing checklist block (before any non-checklist content that follows).

3. Update the parent issue:

   ```bash
   gh issue edit <PARENT_NUMBER> --body "<updated_body>"
   ```

   **IMPORTANT**: Always show the user a diff of the proposed body changes and get confirmation before updating the parent issue. The parent issue body may contain important content beyond the checklist.

---

## Example Interaction

```
User: /track-issues 3713

Claude: Let me audit the tracking for issue #3713...

Parent issue: #3713 — Go-to-TypeScript migration tracking
Label: ts-migration
Tracked issues: 24 total (18 checked, 6 unchecked)

Found 8 merged PRs with label "ts-migration" since v1.32.0

Analyzing PRs for linked issues...

## Tracking Audit for #3713

### Fully Tracked (no action needed)
| PR | Linked Issue | In Checklist |
|----|-------------|-------------|
| #3758 | #3745 | Yes |
| #3753 | #3742 | Yes |
| #3750 | #3740 | Yes |

### Linked but Not in Checklist (need to add)
| PR | Linked Issue | Status |
|----|-------------|--------|
| #3760 | #3755 | closed |

### No Linked Issue (need to create)
| PR | Title |
|----|-------|
| #3762 | Simplify QuartoProjectHelper to use direct filesystem check |

### Summary
- Fully tracked: 3
- Need to add to checklist: 1
- Need new issue: 1

Would you like me to:
1. Create missing issues only
2. Update parent checklist only
3. Both (create issues + update checklist)

User: 3

Claude: Creating issue for PR #3762...
Created #3770: "Simplify QuartoProjectHelper to use direct filesystem check"
Closed #3770 (work already completed)

Updating #3713 checklist — adding:
+ - [x] #3755
+ - [x] #3770

Here's the diff of the parent issue body:
[shows diff]

Proceed with updating the parent issue? (y/n)

User: y

Claude: Updated #3713. Checklist now has 26 tracked issues (20 checked, 6 unchecked).
```

---

## Notes

- This skill relies on the `gh` CLI being authenticated with appropriate permissions to create/close issues and edit issue bodies.
- The `closingIssuesReferences` field in the GitHub API tracks issues linked via "Closes #NNN" or the PR sidebar. PRs without this linkage will show up as needing new issues.
- When updating the parent issue body, be conservative — only add to the checklist, never remove or reorder existing entries.
- Re-run this skill periodically as new PRs are merged to keep the tracking issue up to date.

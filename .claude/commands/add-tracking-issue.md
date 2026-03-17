# Add Tracking Issue

Quickly create a new issue and add it to a parent tracking issue's checklist.

Use this when you discover follow-up work during development that should be tracked under a parent issue.

## Arguments

`$ARGUMENTS` should contain the parent issue number and a description of the new issue, e.g.:

```
/add-tracking-issue 3713 Move fsUtils to a shared utility module
```

If `$ARGUMENTS` is empty or missing the parent issue number, ask the user for both the parent issue number and a title/description for the new issue.

---

## Step 1: Parse Arguments

Extract from `$ARGUMENTS`:

- **Parent issue number** — the first token if it's numeric
- **New issue title** — everything after the parent issue number

If the title is missing or too vague, ask the user to clarify what the new issue should cover.

---

## Step 2: Read the Parent Issue

Fetch the parent issue to get its label and current checklist.

```bash
gh issue view <PARENT_NUMBER> --repo posit-dev/publisher --json title,body,labels
```

1. Identify the label (e.g., `ts-migration`) to apply to the new issue.
2. Parse the tracking checklist to confirm the structure (Completed / Remaining sections, or a flat checklist).

Present a one-line confirmation:

```
Parent: #NNNN — <title> (label: <label>)
```

---

## Step 3: Create the New Issue

Create the issue with the parent's label.

```bash
gh issue create --repo posit-dev/publisher --title "<title>" --body "Tracked in #<PARENT_NUMBER>." --label "<label>"
```

If the parent has no labels, create the issue without a label.

Report the new issue number:

```
Created #NNNN: <title>
```

---

## Step 4: Add to Parent Checklist

Add the new issue to the **Remaining** (unchecked) section of the parent's checklist.

1. Fetch the current body:

   ```bash
   gh issue view <PARENT_NUMBER> --repo posit-dev/publisher --json body --jq '.body'
   ```

2. Append `- [ ] #NNNN` at the end of the Remaining/unchecked section. If the checklist has distinct "Completed" and "Remaining" sections, add to the end of Remaining. If it's a flat checklist, add at the end of the unchecked items.

3. Show the user the change:

   ```
   Adding to #<PARENT> checklist:
   + - [ ] #NNNN
   ```

4. Update the parent:

   ```bash
   gh issue view <PARENT_NUMBER> --repo posit-dev/publisher --json body --jq '.body' | <insert new line> | gh issue edit <PARENT_NUMBER> --repo posit-dev/publisher --body-file -
   ```

---

## Step 5: Confirm

```
Done. Created #NNNN and added to #<PARENT> tracking checklist.
```

---

## Example Interaction

```
User: /add-tracking-issue 3713 Move fsUtils to a shared utility module

Claude: Parent: #3713 — Remove Go binary (label: ts-migration)

Created #3780: Move fsUtils to a shared utility module

Adding to #3713 checklist:
+ - [ ] #3780

Done. Created #3780 and added to #3713 tracking checklist.
```

---

## Notes

- The new issue is created **open** since the work hasn't been done yet. If the work is already complete, tell the user to use `/track-issues` instead to audit and backfill.
- The issue body references the parent with "Tracked in #NNNN" so there's a bidirectional link.
- Only adds to the checklist — never modifies or reorders existing entries.

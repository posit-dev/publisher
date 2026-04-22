# Smoke Test Content for PR #3978 / #3979 / #3980

Test projects for manually verifying the R library mapper and `packages_from_library` feature.

## Setup

Both projects need a real renv library to work with `packages_from_library = true`.
From each project directory, run:

```r
# Initialize renv (creates renv/ directory and library)
renv::init()
# Or if renv.lock already exists:
renv::restore()
```

This populates `renv/library/` with the installed packages whose DESCRIPTION
files the library mapper reads.

## Projects

### `r-shiny-library/` — packages_from_library = true (NEW path)

Exercises the new library mapper (`libraryToManifestPackages`). Config has
`packages_from_library = true`, so the TS publish path will:

1. Read `renv.lock` for the package list
2. Call R subprocess for `.libPaths()` and `available.packages()`
3. Read each package's `DESCRIPTION` from the renv library
4. Validate version consistency between lockfile and library
5. Build manifest with `Source`, `Repository`, and `description` fields

### `r-shiny-lockfile/` — standard lockfile path (REGRESSION)

Exercises the existing lockfile-only mapper. Config omits
`packages_from_library` (defaults to `false`), so the TS publish path uses
the lockfile mapper directly — no R subprocess, no DESCRIPTION reads.

## What to Verify

See the smoke test plan comment on PR #3980 for the full checklist.

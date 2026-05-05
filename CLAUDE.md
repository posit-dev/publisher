# Project Overview

Posit Publisher is a VSCode/Positron extension that enables deploying Python and R projects to Posit Connect. It is a pure TypeScript project — all functionality (bundling, TOML handling, content inspection, interpreter detection, publishing to Connect and Connect Cloud, credential storage, Snowflake discovery) runs directly in the extension.

## Repository Layout

- `extensions/vscode/` — The VSCode extension itself. Contains the TypeScript source (`src/`), Vue webview (`webviews/homeView/`), and extension-specific build tooling.
- `packages/connect-api/` — Shared npm package: TypeScript client for the Posit Connect REST API (axios-based). Consumed by the extension for standard Connect publishing.
- `packages/connect-cloud-api/` — Shared npm package: TypeScript client for Connect Cloud with OAuth authentication. Consumed by the extension for Connect Cloud device auth flows.
- `test/` — Integration test suites:
  - `test/e2e/` — Cypress-driven end-to-end tests (require Docker).
  - `test/extension-contract-tests/` — Vitest tests validating the extension's use of VSCode/Positron APIs against mocks.
  - `test/connect-api-contracts/` — Contract tests for the Connect API client.
  - `test/sample-content/` — Sample projects used by tests and manual debugging.
- `docs/` — User-facing documentation.
- `scripts/` — Repo-level Python scripts (license checker, release prep, etc.).

# Build Commands

The project uses [Just](https://github.com/casey/just) as the build tool. Run `just -l` to see all available recipes.

```bash
# Default recipe — builds and packages the VSCode extension.
just

# Run a recipe in extensions/vscode/ (e.g., lint, test, package).
just vscode <target>

# Format all code (Prettier, etc.).
just format

# Check formatting without writing.
just check-format

# Run extension contract tests (validates extension uses of VSCode/Positron APIs).
just test-extension-contracts

# Run Connect API contract tests.
just test-connect-contracts

# Run Python script tests (license checker, prepare-release, etc.).
just test-scripts

# Validate Connect API fixtures against the public Swagger spec.
just validate-fixtures

# Print pre-release status based on the version.
just pre-release

# Print the version.
just version
```

## VSCode Extension Development

From `extensions/vscode/`:

```bash
just                    # Clean, configure, and package
just deps               # Install npm dependencies
just lint               # Run ESLint
just test               # Run extension tests (Mocha integration + Vitest unit)
just package            # Package .vsix file

# Rebuild webviews after changes
npm run build --prefix webviews/homeView
```

To run the extension in development:

1. Open `extensions/vscode/` as workspace in VSCode.
2. Run the "Run Extension" debug configuration (F5).

## E2E Tests

E2E tests use Cypress and require Docker. From `test/e2e/`:

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
just build-images       # Build Docker images (first time)
just dev                # Run Cypress interactively
just stop               # Stop Docker containers
```

# Additional Documentation

Subdirectories contain more detailed CLAUDE.md files:

- `extensions/vscode/CLAUDE.md` — VSCode extension development
- `extensions/vscode/webviews/homeView/CLAUDE.md` — Vue webview development

# Testing Conventions

- The VSCode extension uses Mocha for integration tests (`src/test/`) and Vitest for unit tests (`src/**/*.test.ts`).
- TypeScript packages (`packages/`) use Vitest.
- E2E tests use Cypress (`test/e2e/`).
- Python script tests use `pytest` (`scripts/`).

# Updating Dependencies

## NPM dependencies

Handled via Dependabot PRs or manual updates. Install hooks before committing:

```bash
# Installs every workspace (extension, homeView webview, shared packages, TS tests).
npm install

# e2e tests are not in the workspace because of their Cypress install weight and
# postinstall hook — install separately when needed:
npm install --prefix=test/e2e
```

# Git Workflow

**CRITICAL: Never push directly to main.** All changes must go through pull requests.

Even for "quick fixes" or "urgent hotfixes":

1. Create a new branch from main
2. Make your changes on the branch
3. Push the branch and open a PR
4. Wait for review/approval before merging

Do NOT use `git push origin main` under any circumstances. If you find yourself about to push to main, stop and create a branch instead.

# CHANGELOG Conventions

When adding entries to CHANGELOG.md:

- **Reference issue numbers, not PR numbers.** Issues represent the user-facing problem or feature request. Use `(#1234)` format where `1234` is the GitHub issue number.
- If no issue exists for the change, create one before adding the changelog entry.
- Follow [Keep a Changelog](https://keepachangelog.com/) format with sections: Added, Changed, Fixed, Deprecated, Removed, Security.
- Write entries from the user's perspective, focusing on what changed for them.
- Use the `/changelog` skill to help draft entries.

# Schema Updates

Schemas live at `extensions/vscode/src/toml/schemas/`:

- `posit-publishing-schema-v3.json` — Configuration schema
- `posit-publishing-record-schema-v3.json` — Deployment record schema

Non-breaking changes don't require version bumps. Update the schema file, corresponding example file, and verify unit tests pass.

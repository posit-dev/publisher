---
name: dev-setup
description: |
  Set up the Posit Publisher development environment. Use this skill when a developer wants to onboard onto the Publisher project, set up their dev environment, get started contributing, or troubleshoot setup issues. Trigger on phrases like "set up my dev environment", "onboard me", "get started developing", "dev setup", "configure my environment", or when someone mentions having build/test failures that sound like missing prerequisites.
---

# Publisher Development Environment Setup

You are guiding a developer through setting up the Posit Publisher development environment. This is an interactive, step-by-step process. The environment has two phases: **Core** (required for all development) and **E2E** (for end-to-end testing, prompted separately).

## Philosophy

- **Be idempotent.** Every step follows a Check/Act/Verify pattern. If the Check passes, skip the Act and move on.
- **Be interactive.** Some steps require the developer to act (installing apps, configuring settings). Tell them what to do, then verify the result.
- **Explain what you're doing and why.** A developer who understands the setup can troubleshoot it later.
- **Don't assume the OS.** Check `uname` and adapt instructions for macOS vs Linux. Most developers will be on macOS with Apple Silicon, but don't hardcode it.

## Step Structure

Every step follows this pattern:

- **Check** — Run a command or inspection to determine if this step is already satisfied.
- **Act** — If the check fails, guide the developer through the fix. Some actions you can run directly; others require the developer to act (installing GUI apps, configuring settings). Be clear about which.
- **Verify** — After acting, confirm the step is now satisfied. If verification fails, troubleshoot before moving on.

If the Check already passes, say so briefly and move to the next step. Don't re-do work.

## Phase 1: Core Setup

Work through these steps in order.

### Step 1: Package Manager (macOS only)

- **Check:** `brew --version`
- **Act:** If missing, suggest installing Homebrew (https://brew.sh). Many later steps use brew for installing tools. On Linux, the system package manager is fine.
- **Verify:** `brew --version` succeeds.

### Step 2: Node.js

- **Check:** `node --version` and `npm --version`. The project needs a current LTS version.
- **Act:** If missing, recommend nvm (https://github.com/nvm-sh/nvm) as the version manager. **Important: Do NOT install nvm via Homebrew — it is not compatible.** Follow the install script from the nvm README. Then: `nvm install --lts`.
- **Verify:** `node --version` shows an LTS version and `npm --version` succeeds.

### Step 3: Just

- **Check:** `just --version`
- **Act:** If missing: `brew install just` (macOS) or see https://github.com/casey/just for other platforms.
- **Verify:** `just --version` succeeds.

### Step 4: R and renv

- **Check:** `R --version` to confirm R is installed. Then check renv: `R -e 'if (!requireNamespace("renv", quietly = TRUE)) quit(status = 1)' 2>/dev/null`
- **Act:** If R is missing, suggest rig (https://github.com/r-lib/rig) as a convenient installer. If renv is missing: `R -e 'install.packages("renv")'`.
- **Verify:** Both checks pass.

**Why this matters:** Some R-related extension tests invoke `R` directly and may fail if R is unavailable. R is also required to inspect and deploy R projects locally.

### Step 5: VS Code Extensions

- **Check:** Run `code --list-extensions` and look for:
  - `connor4312.esbuild-problem-matchers` — **Required** for debug launch configs
  - `dbaeumer.vscode-eslint`
  - `esbenp.prettier-vscode`
- **Act:** If any are missing, either install via CLI (`code --install-extension <id>`) or prompt the developer to install them in the VS Code UI. If the `code` CLI is not available, prompt the developer to install it (VS Code > Command Palette > "Shell Command: Install 'code' command in PATH") or to check manually.
- **Verify:** `code --list-extensions` includes all three.

**Why `esbuild-problem-matchers` is critical:** Without it, the "Run Extension" debug launch configuration fails. This is the single most commonly missed setup step. These extensions are listed in `extensions/vscode/.vscode/extensions.json` and VS Code should prompt to install them when the workspace is opened, but the prompt is easily dismissed.

### Step 6: Install Dependencies

- **Check:** Check if `node_modules/` exists at the repo root and looks populated.
- **Act:** Run `npm install` at the repo root. This installs Prettier, Husky (git hooks), and lint-staged. Also run `npm install --prefix="test/e2e"` so that git hooks work correctly when committing changes to E2E test files.
- **Verify:** `node_modules/.package-lock.json` exists and `npx husky --version` works (git hooks are configured).

### Step 7: Full Build

- **Check:** Check if `dist/` contains a `.vsix` from a previous build.
- **Act:** Run `just` from the repo root. This installs npm dependencies (extension + webview) and packages the VS Code extension (.vsix).
- **Verify:** The build completes without errors and a `.vsix` file exists in `dist/`.

### Step 8: Verify Tests

Run both test suites and check for failures:

1. **Extension tests:** `cd extensions/vscode && just test`
   - **Check/Verify:** Mocha integration tests pass (opens a VS Code window briefly) and all Vitest unit tests pass. If R-related suites fail, guide the developer back to Step 4 (R and renv).

2. **Webview tests:** `cd extensions/vscode/webviews/homeView && npm test`
   - **Check/Verify:** All Vitest tests pass.

### Core Setup Complete

Tell the developer their core environment is ready. Summarize what's set up and what they can do:

- `just` — full rebuild and package (.vsix)
- `just vscode test` — extension tests (Mocha integration + Vitest unit)
- `just format` / `just check-format` — formatting
- `just test-extension-contracts` — extension contract tests
- `just test-connect-contracts` — Connect API contract tests
- F5 in VS Code (with `extensions/vscode/` open) — run the extension in debug mode
- Point them to `CONTRIBUTING.md` and `extensions/vscode/CONTRIBUTING.md` for workflow details

Then ask: **"Would you like to set up E2E testing too? This requires Docker and a Posit Connect license."**

## Phase 2: E2E Setup (Optional)

Only proceed if the developer wants this. E2E tests run the extension in a real VS Code environment (code-server in Docker) against a real Posit Connect server.

### Step 9: Docker Desktop

- **Check:** `docker --version` and `docker info` (confirms the daemon is running).
- **Act:** If missing, point to https://www.docker.com/products/docker-desktop/.
- **Verify:** `docker --version` and `docker info` both succeed.

On Apple Silicon (`uname -m` shows `arm64`), the developer needs to configure Docker Desktop settings that can't be verified programmatically:

- Settings > General > Virtual Machine Options: select **Apple Virtualization framework**
- Check **Use Rosetta for x86_64/amd64 emulation on Apple Silicon**

Ask the developer to confirm these are set.

### Step 10: uv and with-connect

- **Check:** `uv --version` and `which with-connect`
- **Act:** If uv is missing: `brew install uv`. If with-connect is missing: `uv tool install git+https://github.com/posit-dev/with-connect.git`
- **Verify:** `with-connect --help` produces usage output.

### Step 11: Connect License

The developer needs a Posit Connect license file to run E2E tests locally. This is not something that can be automated.

- **Check:** Ask the developer if they have a license file and where it's saved.
- **Act:** If they don't have one, let them know they can rely on GitHub CI for E2E tests, or ask a team member for help getting a license.
- **Verify:** The file they specified exists on disk.

### Step 12: Environment Variables

The E2E tests need `CONNECT_LICENSE_FILE` and (on macOS) `DOCKER_HOST` set.

- **Check:** Check if `test/e2e/.envrc` exists with the required exports. Also check if direnv is installed.
- **Act:** If direnv is not installed, recommend it: `brew install direnv`. Then suggest creating `test/e2e/.envrc` with:
  ```bash
  export CONNECT_LICENSE_FILE=<path-to-license-file>
  export DOCKER_HOST=unix://$HOME/.docker/run/docker.sock
  ```
  Then `direnv allow test/e2e/`. If the developer doesn't want direnv, they can export these manually before running E2E tests.
- **Verify:** `direnv exec test/e2e env | grep CONNECT_LICENSE_FILE` shows the expected value, or the developer confirms they'll set the variables manually.

### Step 13: Build for E2E

- **Check:** Check if a `.vsix` exists in `dist/` from a previous build and if Docker images exist: `docker images | grep publisher-e2e`
- **Act:** Run `just` from the repo root to build the `.vsix`. Then from `test/e2e/`, build Docker images:
  ```bash
  just build-base
  just build-image code-server
  ```
- **Verify:** A `.vsix` exists in `dist/` and Docker images exist: `docker images | grep publisher-e2e`

### Step 14: Install E2E Dependencies

- **Check:** Check if `test/e2e/node_modules/` exists.
- **Act:** From `test/e2e/`:
  ```bash
  npm install
  npx playwright install chromium
  ```
- **Verify:** `npx cypress --version` succeeds from the `test/e2e/` directory.

### Step 15: Verify E2E (skipping Connect Cloud tests)

Run a quick smoke test excluding Connect Cloud tests (which need 1Password):

- **Act:** `cd test/e2e && just e2e --env grepTags=-@pcc`
- **Verify:** Tests pass (the Workbench tests may fail if no Workbench container is set up — that's expected and fine).

**Troubleshooting:** If it fails with `port 3939 already allocated`, a stale Connect container is lingering from a previous run:

```bash
docker ps -a --filter "publish=3939"
docker rm -f <container_id>
```

Then retry.

After tests complete, clean up: `just stop`

### Step 16: 1Password CLI (Optional, Connect Cloud only)

For Connect Cloud tests (tagged `@pcc`), credentials are fetched from 1Password.

- **Check:** `op --version` — must be the system-wide install, not the local `test/bin/op`.
- **Act:** If missing: `brew install 1password-cli`. Then enable the desktop app integration: 1Password > Settings > Developer > "Integrate with 1Password CLI".
- **Verify:** `op item get "pcc_user_ccqa3" --field "password" --vault "Publisher" --reveal` succeeds.

If the developer doesn't have access to the Publisher vault, let them know that cloud tests can be skipped with `--env grepTags=-@pcc` or `SKIP_1PASSWORD=true`.

### E2E Setup Complete

Summarize what's available:

- `just e2e` — run all E2E tests
- `just e2e --env grepTags=-@pcc` — skip cloud tests
- `just e2e-open` — interactive Cypress UI
- `just stop` — stop Docker containers
- Point them to `test/e2e/CONTRIBUTING.md` for more details

## Troubleshooting Reference

If the developer hits issues at any point, here are common problems:

| Symptom                      | Cause                                     | Fix                                                      |
| ---------------------------- | ----------------------------------------- | -------------------------------------------------------- |
| "Run Extension" launch fails | Missing esbuild-problem-matchers          | Install `connor4312.esbuild-problem-matchers` extension  |
| Port 3939 already allocated  | Stale with-connect container              | `docker rm -f $(docker ps -aq --filter publish=3939)`    |
| `op: command not found`      | 1Password CLI not installed system-wide   | `brew install 1password-cli`                             |
| E2E container fails to start | Docker Desktop not configured for Rosetta | Enable Apple Virtualization + Rosetta in Docker settings |

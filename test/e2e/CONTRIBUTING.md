# E2E Testing Guide

End-to-end tests use Cypress to test the Posit Publisher extension in a real VS Code environment with a Posit Connect server.

## Requirements

### Docker Desktop

Docker Desktop is required. On Apple Silicon:

- Select `Apple Virtualization framework` in the "Virtual Machine Options" general settings
- Check `Use Rosetta for x86_64/amd64 emulation on Apple Silicon`

### with-connect CLI

Install the CLI that manages the Connect server:

```bash
uv tool install git+https://github.com/posit-dev/with-connect.git
```

### Connect License

Running E2E tests locally requires a Posit Connect license. You can either rely on GitHub CI to run these tests, or contact a member of the team to help get a license set up.

Save your license to a file (this guide assumes `~/connect-license.lic`).

### Workbench License (optional)

For Workbench tests, create `test/e2e/licenses/workbench-license.lic`. In CI, this is stored in GitHub secrets.

## Setup

**1. Install dependencies:**

```bash
npm install
npx playwright install chromium
```

**2. Build the Publisher extension** (from repo root):

```bash
USE_PLATFORM="linux/amd64" just
```

**3. Build Docker images:**

```bash
# Base image (first time only)
just build-base

# code-server image
just build-image code-server
```

## Running Tests

### Using Justfile Commands

```bash
# Set environment
export CONNECT_LICENSE_FILE=~/connect-license.lic
export DOCKER_HOST=unix://$HOME/.docker/run/docker.sock  # macOS only

# Run all tests
just e2e

# Run specific test file
just e2e --spec "tests/credentials.cy.js"

# Run multiple test files
just e2e --spec "tests/common.cy.js,tests/deployments.cy.js"

# Exclude @pcc tests (no cloud credentials needed)
just e2e --env grepTags=-@pcc

# Interactive Cypress UI
just e2e-open

# Build publisher and run tests
just dev
```

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│     Cypress     │────▶│   code-server    │────▶│  Posit Connect  │
│  (test runner)  │     │ (VS Code in web) │     │  (with-connect) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
     localhost              :8080                      :3939
```

- **with-connect** manages the Connect server lifecycle (pull image, license, API key)
- **code-server** runs VS Code in a browser with the Publisher extension
- **Cypress** automates browser interactions for testing

Containers reach Connect via `connect-publisher-e2e` hostname mapped to host-gateway.

## Test Categories

### Connect Server Tests

Most tests use the local Connect server. These work with just a Connect license.

### Connect Cloud Tests (@pcc)

Tests tagged `@pcc` require Posit Connect Cloud credentials configured in `config/staging-pccqa.json`. Exclude them with:

```bash
just e2e --env grepTags=-@pcc
```

### Workbench Tests

Require the Workbench container:

```bash
just pull-workbench release
just start-workbench release
just install-positron-extension release
just e2e --spec "tests/workbench/**/*.cy.js"
```

## Testing Against Specific Connect Versions

```bash
with-connect --license ~/connect-license.lic --version 2025.03.0 -- \
  bash -c 'CYPRESS_BOOTSTRAP_ADMIN_API_KEY=$CONNECT_API_KEY npx cypress run'
```

## Manual Testing

For manual testing without Cypress, start Connect in persistent mode:

```bash
just start code-server
eval $(with-connect --license ~/connect-license.lic)
# Connect running at http://localhost:3939
# code-server at http://localhost:8080
```

## Debugging

### View test screenshots

Failed test screenshots are saved to `cypress/screenshots/`.

### Enable video recording

```bash
DEBUG_CYPRESS=true just e2e
```

### Repeat tests for flakiness

```bash
./repeat-cypress-headless.sh REPEAT=5 tests/credentials.cy.js
```

## CI

Tests run automatically in GitHub Actions after unit tests pass. The workflow:

- Uses `CONNECT_LICENSE` secret for licensing
- Uploads screenshots as artifacts on failure
- Supports video recording via `ACTIONS_STEP_DEBUG=true`

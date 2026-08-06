// Copyright (C) 2026 by Posit Software, PBC.

import { rm } from "fs/promises";
import path from "path";

// Contract tests that dynamically import src/extension (activation.test.ts,
// extension-settings.test.ts) pull in the real snowflake-sdk package via
// src/snowflake/sdkConfig.ts, which is not mocked. snowflake-sdk writes its
// own log file to the process cwd as soon as it's configured, with no way to
// opt out short of mocking the whole module. Remove the stray file before and
// after the run so it doesn't accumulate as an untracked file in the repo.
const snowflakeLog = path.join(process.cwd(), "snowflake.log");

async function removeSnowflakeLog() {
  await rm(snowflakeLog, { force: true });
}

export async function setup() {
  await removeSnowflakeLog();
}

export async function teardown() {
  await removeSnowflakeLog();
}

// Copyright (C) 2026 by Posit Software, PBC.

import { promises as fs } from "fs";
import * as path from "path";

import { logger } from "./logging";

/**
 * The posit-env environment the current session runs on, when there is one.
 *
 * Workbench sessions launched through the posit-env launcher plugin carry the
 * environment's identity in the process environment (`POSIT_ENV_NAME`,
 * `POSIT_ENV_DIGEST`, `POSIT_ENV_PATH`, `POSIT_ENV_SERVER`). When Publisher
 * detects one, the published bundle carries a `posit-env.json` marker and
 * Connect's environment management is switched off in the manifest — the
 * posit-env supervisor on the Connect server materializes exactly this
 * environment (by digest) to run the content, instead of Connect rebuilding
 * an approximation from requirements.txt / renv.lock.
 */
export interface PositEnvironment {
  /** Environment reference the session was launched with (ns/env:tag). */
  ref: string;
  /** Immutable lock digest (sha256:…) — what the deploy is pinned to. */
  digest: string;
  /** Realization path in the session (…/<digest>/<platform>). */
  envPath: string;
  /** Realization platform, e.g. linux-amd64. */
  platform?: string;
  /** posit-env registry URL, as reachable from the session. */
  server?: string;
}

/** Bundle-relative marker file the Connect supervisor looks for. */
export const POSIT_ENV_MARKER_FILE = "posit-env.json";

/**
 * Detect the session's posit-env environment from the process environment.
 * Returns undefined outside a posit-env session; never throws.
 */
export async function detectPositEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): Promise<PositEnvironment | undefined> {
  const ref = env.POSIT_ENV_NAME;
  const digest = env.POSIT_ENV_DIGEST;
  const envPath = env.POSIT_ENV_PATH;
  if (!ref || !digest || !envPath) {
    return undefined;
  }

  const detected: PositEnvironment = {
    ref,
    digest,
    envPath,
    server: env.POSIT_ENV_SERVER || undefined,
  };

  // Platform from the realization's receipt; the store layout
  // (<store>/<digest>/<platform>) is the fallback.
  try {
    const raw = await fs.readFile(
      path.join(envPath, ".posit-env", "receipt.json"),
      "utf-8",
    );
    const receipt = JSON.parse(raw) as { platform?: string };
    if (receipt.platform) {
      detected.platform = receipt.platform;
    }
  } catch (err) {
    logger.debug(
      `posit-env receipt not readable at ${envPath}, falling back to path: ${err}`,
    );
  }
  if (!detected.platform) {
    detected.platform = path.basename(envPath) || undefined;
  }

  return detected;
}

/**
 * The `posit-env.json` content for the bundle: enough for the Connect
 * supervisor to materialize the environment (`ref` pinned by `digest`)
 * and to know which registry to ask (`server` is a fallback — the
 * Connect host's own POSIT_ENV_SERVER wins).
 */
export function positEnvMarker(e: PositEnvironment): Buffer {
  return Buffer.from(
    JSON.stringify(
      {
        ref: e.ref,
        digest: e.digest,
        ...(e.platform && { platform: e.platform }),
        ...(e.server && { server: e.server }),
      },
      null,
      2,
    ) + "\n",
  );
}

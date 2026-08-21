// Copyright (C) 2026 by Posit Software, PBC.

import { logger } from "src/logging";
import { getMessageFromError } from "src/utils/errors";
import { createOAuthHttpClient } from "./httpClient";

/**
 * The Posit Workbench session Publisher is running inside, when it is.
 *
 * Workbench serves VS Code and Positron through the browser, so a loopback
 * redirect on the extension host is unreachable from the user's browser. It does
 * however expose a generic OAuth relay — `/oauth_redirect_callback` records the
 * authorization code against the `state` parameter, and `/oauth_code?state=`
 * hands it back once (single-use). That relay is the redirect target Publisher
 * uses in Workbench, exactly as Workbench's own VS Code extension does
 * (`rstudio-workbench-vscode-ext` `src/utils/oauthClient.ts`).
 */
export interface WorkbenchEnvironment {
  /**
   * Browser-reachable Workbench base URL, from `RS_SERVER_URL`. This is what the
   * `redirect_uri` must be built from, since the OAuth provider redirects the
   * user's browser there.
   */
  externalServerUrl: string;
  /**
   * Host-reachable Workbench base URL, from `RS_SERVER_ADDRESS` (typically
   * `http://localhost:8787`). Polling for the code goes here — it bypasses the
   * browser session cookie the external URL would require.
   */
  serverAddress: string;
}

/**
 * A failure of the Workbench OAuth relay. `terminal` distinguishes "this
 * environment can't use the relay, try another flow" (e.g. the relay is
 * unreachable) from "the user's authorization attempt itself failed" (denied or
 * timed out), which should be surfaced rather than silently retried in another
 * flow.
 */
export class WorkbenchRelayError extends Error {
  constructor(
    message: string,
    public readonly terminal: boolean,
  ) {
    super(message);
    this.name = "WorkbenchRelayError";
  }
}

/** Workbench's generic OAuth redirect target (registers `state` → `code`). */
const WORKBENCH_REDIRECT_PATH = "/oauth_redirect_callback";
/** Workbench's single-use code lookup, keyed by `state`. */
const WORKBENCH_CODE_PATH = "/oauth_code";

/** How often to ask Workbench whether the code has arrived. */
export const WORKBENCH_POLL_MS = 5_000;
/** How long to wait for the user to finish authorizing in their browser. */
export const WORKBENCH_TIMEOUT_MS = 600_000;

/**
 * Statuses that mean "not yet" rather than "failed" — Workbench 404s until the
 * redirect lands, and can shed load with 429/503. Mirrors the retry set in both
 * Workbench's homepage client and its VS Code extension.
 */
const RETRY_STATUSES = [404, 429, 503];

/**
 * A `state` value used only to probe that the relay route exists. Never sent to
 * Connect, so it can be a fixed string.
 */
const PROBE_STATE = "posit-publisher-probe";

/**
 * Normalizes a Workbench-provided base URL: drops any query string (Workbench
 * appends one to `RS_SERVER_URL`) and trailing slashes, and rejects anything
 * that isn't HTTP(S).
 */
function normalizeBaseUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const withoutQuery = value.trim().split("?", 1)[0] ?? "";
  const trimmed = withoutQuery.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

/**
 * Detects a Posit Workbench session from the environment variables Workbench
 * sets on every session (`SessionConstants.hpp`). Returns `undefined` when not
 * running under Workbench, or when either URL is missing/not HTTP(S) — in which
 * case the relay can't be used and the caller falls back to the device flow.
 */
export function detectWorkbench(
  env: NodeJS.ProcessEnv = process.env,
): WorkbenchEnvironment | undefined {
  const externalServerUrl = normalizeBaseUrl(env.RS_SERVER_URL);
  const serverAddress = normalizeBaseUrl(env.RS_SERVER_ADDRESS);
  if (!externalServerUrl || !serverAddress) {
    return undefined;
  }
  return { externalServerUrl, serverAddress };
}

/**
 * The `redirect_uri` to register with Connect and send in the authorize request
 * when running under Workbench. Connect only accepts non-loopback redirect URIs
 * that an administrator has allowlisted, so this requires the Workbench URL to
 * be listed in Connect's `AllowedRedirectURIs` for the OAuth flow to be usable;
 * otherwise registration fails and the caller falls back to the device flow.
 */
export function workbenchRedirectUri(workbench: WorkbenchEnvironment): string {
  return `${workbench.externalServerUrl}${WORKBENCH_REDIRECT_PATH}`;
}

function isCodeResponse(data: unknown): data is { code: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    "code" in data &&
    typeof data.code === "string" &&
    data.code !== ""
  );
}

/**
 * Verifies the relay is reachable before the browser is sent anywhere, so an
 * unusable Workbench deployment falls back to the device flow immediately
 * instead of after a long poll. A well-formed `GET /oauth_code?state=` for an
 * unknown state answers 404 — anything other than a reachable HTTP response
 * (connection refused, TLS failure, proxy HTML) means the relay isn't usable.
 */
export async function isWorkbenchRelayReachable(
  workbench: WorkbenchEnvironment,
  insecure: boolean,
): Promise<boolean> {
  try {
    const http = createOAuthHttpClient(insecure);
    const resp = await http.get(
      `${workbench.serverAddress}${WORKBENCH_CODE_PATH}?state=${encodeURIComponent(PROBE_STATE)}`,
    );
    // 404 is the expected answer for an unknown state; 400 (missing/invalid
    // state) and the load-shedding statuses still prove the route exists.
    return [400, 404, 429, 503].includes(resp.status);
  } catch (err) {
    logger.debug(
      `Posit Workbench OAuth relay is not reachable: ${getMessageFromError(err)}`,
    );
    return false;
  }
}

/**
 * Polls Workbench's OAuth relay for the authorization code recorded against
 * `state`. Resolves with the code, or throws a {@link WorkbenchRelayError} when
 * the user denied the request, the relay reports an unexpected failure, or the
 * deadline passes.
 */
export async function pollWorkbenchAuthCode(
  workbench: WorkbenchEnvironment,
  state: string,
  insecure: boolean,
  timeoutMs: number = WORKBENCH_TIMEOUT_MS,
): Promise<string> {
  const http = createOAuthHttpClient(insecure);
  const url = `${workbench.serverAddress}${WORKBENCH_CODE_PATH}?state=${encodeURIComponent(state)}`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, WORKBENCH_POLL_MS));

    let resp;
    try {
      resp = await http.get(url);
    } catch (err) {
      throw new WorkbenchRelayError(
        `Posit Workbench became unreachable while waiting for authorization: ${getMessageFromError(err)}`,
        false,
      );
    }
    if (resp.status === 200 && isCodeResponse(resp.data)) {
      return resp.data.code;
    }
    if (resp.status === 403) {
      // The relay records an empty code when the provider returned an error, so
      // a 403 means the user (or Connect) denied the request. Terminal: retrying
      // in another flow would just ask the user to deny it again.
      throw new WorkbenchRelayError("Authorization was denied.", true);
    }
    if (!RETRY_STATUSES.includes(resp.status)) {
      throw new WorkbenchRelayError(
        `Posit Workbench returned an unexpected status (${resp.status}) while waiting for authorization.`,
        false,
      );
    }
    logger.debug(
      `Waiting for the Posit Workbench OAuth redirect (status ${resp.status}).`,
    );
  }

  throw new WorkbenchRelayError(
    "Timed out waiting for authorization in your browser.",
    true,
  );
}

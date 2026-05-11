// Copyright (C) 2026 by Posit Software, PBC.

import { ConnectAPI, ConnectAPIError } from "@posit-dev/connect-api";
import type { User } from "@posit-dev/connect-api";

import { AgentError } from "src/api/types/error";
import { ServerType } from "src/api/types/contentRecords";
import { TestResult } from "src/api/types/credentials";
import type { ErrorCode } from "src/utils/errorTypes";
import { serverTypeFromURL, discoverServerURL } from "src/utils/url";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const CERTIFICATE_ERROR_PATTERNS = [
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "CERT_HAS_EXPIRED",
  "unable to verify the first certificate",
];

function isCertificateError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return CERTIFICATE_ERROR_PATTERNS.some((pattern) => msg.includes(pattern));
}

function normalizeErrorMessage(msg: string): string {
  const trimmed = msg.trim();
  if (trimmed.length === 0) return trimmed;

  const capitalized = trimmed[0]!.toUpperCase() + trimmed.slice(1);

  const lastChar = capitalized[capitalized.length - 1]!;
  if (["?", "!", ")", "."].includes(lastChar)) {
    return capitalized;
  }
  return capitalized + ".";
}

function isNetworkError(err: unknown): boolean {
  return err instanceof ConnectAPIError && err.httpStatus === undefined;
}

function toAgentError(err: unknown): AgentError {
  const msg = err instanceof Error ? err.message : String(err);

  const code: ErrorCode = isCertificateError(err)
    ? "errorCertificateVerification"
    : isNetworkError(err)
      ? "connectionFailed"
      : "unknown";

  return {
    code,
    msg: normalizeErrorMessage(msg),
    operation: "testCredentials",
  };
}

// ---------------------------------------------------------------------------
// testServerURL — validate reachability and detect server type (no auth)
// ---------------------------------------------------------------------------

export interface TestServerURLParams {
  url: string;
  insecure: boolean;
  timeout?: number;
}

export async function testServerURL(
  params: TestServerURLParams,
): Promise<TestResult> {
  let st: ServerType;
  try {
    st = serverTypeFromURL(params.url);
  } catch (err) {
    return {
      user: null,
      url: null,
      serverType: null,
      error: toAgentError(err),
    };
  }

  // Snowflake URLs don't expose the Connect API directly — skip the probe.
  if (st === ServerType.SNOWFLAKE) {
    return {
      user: null,
      url: params.url,
      serverType: st,
      error: null,
    };
  }

  const timeoutMs = Math.max(params.timeout ?? 30, 30) * 1000;

  const tester = async (urlToTest: string): Promise<void> => {
    const client = new ConnectAPI({
      url: urlToTest,
      rejectUnauthorized: !params.insecure,
      timeout: timeoutMs,
    });

    try {
      await client.testAuthentication();
    } catch (err) {
      // 401 means the server is reachable but requires auth — that's success.
      if (err instanceof ConnectAPIError && err.httpStatus === 401) {
        return;
      }
      throw err;
    }
  };

  const discovery = await discoverServerURL(params.url, tester);

  if (discovery.error === undefined) {
    return {
      user: null,
      url: discovery.url,
      serverType: st,
      error: null,
    };
  }

  return {
    user: null,
    url: params.url,
    serverType: st,
    error: toAgentError(discovery.error),
  };
}

// ---------------------------------------------------------------------------
// testAuthentication — verify credentials authenticate successfully
// ---------------------------------------------------------------------------

export interface TestAuthenticationParams {
  url: string;
  apiKey: string;
  snowflakeToken?: string;
  insecure: boolean;
  timeout?: number;
}

export async function testAuthentication(
  params: TestAuthenticationParams,
): Promise<TestResult> {
  let st: ServerType;
  try {
    st = serverTypeFromURL(params.url);
  } catch (err) {
    return {
      user: null,
      url: null,
      serverType: null,
      error: toAgentError(err),
    };
  }

  let lastUser: User | null = null;
  const timeoutMs = Math.max(params.timeout ?? 30, 30) * 1000;

  const tester = async (urlToTest: string): Promise<void> => {
    const auth = params.snowflakeToken
      ? { snowflakeToken: params.snowflakeToken, apiKey: params.apiKey }
      : { apiKey: params.apiKey };
    const client = new ConnectAPI({
      url: urlToTest,
      ...auth,
      rejectUnauthorized: !params.insecure,
      timeout: timeoutMs,
    });

    const result = await client.testAuthentication();
    lastUser = result.user;
  };

  const discovery = await discoverServerURL(params.url, tester);

  if (discovery.error === undefined) {
    return {
      user: lastUser,
      url: discovery.url,
      serverType: st,
      error: null,
    };
  }

  return {
    user: null,
    url: params.url,
    serverType: st,
    error: toAgentError(discovery.error),
  };
}

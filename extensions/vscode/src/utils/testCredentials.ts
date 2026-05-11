// Copyright (C) 2026 by Posit Software, PBC.

import { ConnectAPI, ConnectAPIError } from "@posit-dev/connect-api";
import type { User } from "@posit-dev/connect-api";

import { AgentError } from "src/api/types/error";
import { ServerType } from "src/api/types/contentRecords";
import { TestResult } from "src/api/types/credentials";
import type { ErrorCode } from "src/utils/errorTypes";
import { serverTypeFromURL, discoverServerURL } from "src/utils/url";

export interface TestCredentialsParams {
  url: string;
  apiKey?: string;
  insecure: boolean;
  timeout?: number; // seconds — minimum 30
}

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

  // Capitalize first letter
  const capitalized = trimmed[0]!.toUpperCase() + trimmed.slice(1);

  // Add terminal period if not ending with special punctuation
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

export async function testCredentials(
  params: TestCredentialsParams,
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

  const hasCredentials = !!params.apiKey;

  // For Snowflake, we initially skip auth testing and just detect the server type.
  // Later in the flow when we have an API token, we will do the full test.
  if (st === ServerType.SNOWFLAKE && !hasCredentials) {
    return {
      user: null,
      url: params.url,
      serverType: st,
      error: null,
    };
  }

  // 3. Build a tester function
  let lastUser: User | null = null;

  const timeoutMs = Math.max(params.timeout ?? 30, 30) * 1000;

  const tester = async (urlToTest: string): Promise<void> => {
    const baseOptions = {
      rejectUnauthorized: !params.insecure,
      timeout: timeoutMs,
    };
    const authOptions = params.apiKey ? { apiKey: params.apiKey } : {};
    const client = new ConnectAPI({
      url: urlToTest,
      ...baseOptions,
      ...authOptions,
    });

    try {
      const result = await client.testAuthentication();
      lastUser = result.user;
    } catch (err) {
      // When no credentials are provided, treat HTTP 401 as success:
      // the server is reachable but requires auth.
      if (
        !hasCredentials &&
        err instanceof ConnectAPIError &&
        err.httpStatus === 401
      ) {
        return;
      }
      throw err;
    }
  };

  // 4. Discover server URL
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

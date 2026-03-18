// Copyright (C) 2025 by Posit Software, PBC.

import { ConnectAPI } from "@posit-dev/connect-api";
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
  "certificate",
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

function toAgentError(err: unknown): AgentError {
  const msg = err instanceof Error ? err.message : String(err);

  const code: ErrorCode = isCertificateError(err)
    ? "errorCertificateVerification"
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
  // 1. Detect server type
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

  // 2. Build a tester function
  let lastUser: User | null = null;

  const timeoutMs = Math.max(params.timeout ?? 30, 30) * 1000;

  const tester = async (urlToTest: string): Promise<void> => {
    const client = new ConnectAPI({
      url: urlToTest,
      apiKey: params.apiKey ?? "",
      insecure: params.insecure,
      timeout: timeoutMs,
    });

    const result = await client.testAuthentication();
    lastUser = result.user;
  };

  // 3. Discover server URL
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

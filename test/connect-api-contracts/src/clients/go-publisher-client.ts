// Copyright (C) 2026 by Posit Software, PBC.

import type {
  ConnectContractClient,
  ConnectContractResult,
  MethodName,
} from "../client";

interface HarnessResponse {
  status: "success" | "error";
  result: unknown;
  error?: string;
  capturedRequests: Array<{
    method: string;
    path: string;
    headers: Record<string, string>;
    body: string | null;
  }>;
}

export class GoPublisherClient implements ConnectContractClient {
  constructor(
    private apiBase: string,
    private connectUrl: string,
    private apiKey: string,
  ) {}

  async call(
    method: MethodName,
    params?: Record<string, unknown>,
  ): Promise<ConnectContractResult> {
    const payload: Record<string, unknown> = {
      method,
      connectUrl: this.connectUrl,
      apiKey: this.apiKey,
      ...params,
    };

    // Encode bundleData as base64 if present
    if (payload.bundleData instanceof Uint8Array) {
      payload.bundleData = Buffer.from(payload.bundleData).toString("base64");
    }

    const res = await fetch(`${this.apiBase}/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const hr: HarnessResponse = await res.json();

    const result: ConnectContractResult = {
      status: hr.status,
      result: hr.result,
      capturedRequest:
        hr.capturedRequests.length > 0 ? hr.capturedRequests[0] : null,
      capturedRequests: hr.capturedRequests,
    };

    // Decode base64 result for DownloadBundle
    if (
      method === "DownloadBundle" &&
      result.status === "success" &&
      typeof result.result === "string"
    ) {
      result.result = new Uint8Array(Buffer.from(result.result, "base64"));
    }

    return result;
  }
}

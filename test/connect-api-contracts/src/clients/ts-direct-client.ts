// Copyright (C) 2026 by Posit Software, PBC.

import type {
  ConnectContractClient,
  ConnectContractResult,
  MethodName,
} from "../client";

/**
 * Stub client for the future TypeScript ConnectClient implementation.
 * As TS client methods get implemented, the call() dispatcher fills in.
 */
export class TypeScriptDirectClient implements ConnectContractClient {
  async call(
    _method: MethodName,
    _params?: Record<string, unknown>,
  ): Promise<ConnectContractResult> {
    throw new Error("Not implemented yet");
  }
}

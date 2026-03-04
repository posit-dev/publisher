import type { ConnectContractClient, ConnectContractResult } from "../client";

/**
 * Stub client for the future TypeScript ConnectClient implementation.
 * As TS client methods get implemented, the call() dispatcher fills in.
 */
export class TypeScriptDirectClient implements ConnectContractClient {
  async call(
    _method: string,
    _params?: Record<string, unknown>,
  ): Promise<ConnectContractResult> {
    throw new Error("Not implemented yet");
  }
}

import type { ConnectContractClient, ConnectContractResult } from "../client";

/**
 * Stub client for the future TypeScript ConnectClient implementation.
 * Each method will call the TS client directly against the mock Connect server.
 * For now, all methods throw "Not implemented yet".
 */
export class TypeScriptDirectClient implements ConnectContractClient {
  async testAuthentication(_params: {
    connectUrl: string;
    apiKey: string;
  }): Promise<ConnectContractResult> {
    throw new Error("Not implemented yet");
  }

  async createDeployment(_params: {
    connectUrl: string;
    apiKey: string;
    body: unknown;
  }): Promise<ConnectContractResult> {
    throw new Error("Not implemented yet");
  }

  async contentDetails(_params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
  }): Promise<ConnectContractResult> {
    throw new Error("Not implemented yet");
  }
}

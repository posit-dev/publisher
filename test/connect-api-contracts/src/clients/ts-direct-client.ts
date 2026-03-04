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

  async getCurrentUser(_params: {
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

  async updateDeployment(_params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
    body: unknown;
  }): Promise<ConnectContractResult> {
    throw new Error("Not implemented yet");
  }

  async getEnvVars(_params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
  }): Promise<ConnectContractResult> {
    throw new Error("Not implemented yet");
  }

  async setEnvVars(_params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
    env: Record<string, string>;
  }): Promise<ConnectContractResult> {
    throw new Error("Not implemented yet");
  }

  async uploadBundle(_params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
    bundleData: Uint8Array;
  }): Promise<ConnectContractResult> {
    throw new Error("Not implemented yet");
  }

  async deployBundle(_params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
    bundleId: string;
  }): Promise<ConnectContractResult> {
    throw new Error("Not implemented yet");
  }

  async waitForTask(_params: {
    connectUrl: string;
    apiKey: string;
    taskId: string;
  }): Promise<ConnectContractResult> {
    throw new Error("Not implemented yet");
  }

  async validateDeployment(_params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
  }): Promise<ConnectContractResult> {
    throw new Error("Not implemented yet");
  }

  async getIntegrations(_params: {
    connectUrl: string;
    apiKey: string;
  }): Promise<ConnectContractResult> {
    throw new Error("Not implemented yet");
  }

  async getSettings(_params: {
    connectUrl: string;
    apiKey: string;
  }): Promise<ConnectContractResult> {
    throw new Error("Not implemented yet");
  }

  async latestBundleId(_params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
  }): Promise<ConnectContractResult> {
    throw new Error("Not implemented yet");
  }

  async downloadBundle(_params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
    bundleId: string;
  }): Promise<ConnectContractResult> {
    throw new Error("Not implemented yet");
  }
}

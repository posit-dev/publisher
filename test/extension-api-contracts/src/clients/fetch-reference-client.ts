import type { ExtensionContractClient, ExtensionContractResult } from "../client";

/**
 * Stub client for a future fetch-based implementation (e.g., Positron).
 * Each method will call the Publisher API using native fetch.
 * For now, all methods throw "Not implemented yet".
 */
export class FetchReferenceClient implements ExtensionContractClient {
  // Configurations

  async getConfigurations(_dir: string): Promise<ExtensionContractResult> {
    throw new Error("Not implemented yet");
  }

  async getConfiguration(_name: string, _dir: string): Promise<ExtensionContractResult> {
    throw new Error("Not implemented yet");
  }

  async createOrUpdateConfiguration(_name: string, _body: unknown, _dir: string): Promise<ExtensionContractResult> {
    throw new Error("Not implemented yet");
  }

  async deleteConfiguration(_name: string, _dir: string): Promise<ExtensionContractResult> {
    throw new Error("Not implemented yet");
  }

  // Credentials

  async listCredentials(): Promise<ExtensionContractResult> {
    throw new Error("Not implemented yet");
  }

  async createCredential(_body: unknown): Promise<ExtensionContractResult> {
    throw new Error("Not implemented yet");
  }

  async getCredential(_guid: string): Promise<ExtensionContractResult> {
    throw new Error("Not implemented yet");
  }

  async deleteCredential(_guid: string): Promise<ExtensionContractResult> {
    throw new Error("Not implemented yet");
  }

  async resetCredentials(): Promise<ExtensionContractResult> {
    throw new Error("Not implemented yet");
  }

  async testCredentials(_url: string, _insecure: boolean, _apiKey?: string): Promise<ExtensionContractResult> {
    throw new Error("Not implemented yet");
  }

  // Deployments

  async getDeployments(_dir: string): Promise<ExtensionContractResult> {
    throw new Error("Not implemented yet");
  }

  async getDeployment(_id: string, _dir: string): Promise<ExtensionContractResult> {
    throw new Error("Not implemented yet");
  }

  async createDeployment(_dir: string, _account?: string, _config?: string, _saveName?: string): Promise<ExtensionContractResult> {
    throw new Error("Not implemented yet");
  }

  async deleteDeployment(_saveName: string, _dir: string): Promise<ExtensionContractResult> {
    throw new Error("Not implemented yet");
  }

  async patchDeployment(_name: string, _dir: string, _data: { configName?: string; guid?: string }): Promise<ExtensionContractResult> {
    throw new Error("Not implemented yet");
  }
}

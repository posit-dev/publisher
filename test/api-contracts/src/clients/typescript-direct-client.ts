import type { BackendClient, ContractResult } from "../client";

/**
 * Stub client for the TypeScript backend implementation.
 * Each method will be wired up as the corresponding TS service is built.
 * For now, all methods throw "Not implemented yet".
 */
export class TypeScriptDirectClient implements BackendClient {
  constructor(private workspaceDir: string) {}

  // Configurations

  async getConfigurations(
    _params?: { dir?: string },
  ): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }

  async getConfiguration(_name: string): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }

  async putConfiguration(
    _name: string,
    _body: unknown,
  ): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }

  async deleteConfiguration(_name: string): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }

  // Credentials

  async getCredentials(): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }

  async postCredential(_body: unknown): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }

  async deleteCredential(_guid: string): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }

  async resetCredentials(): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }

  // Deployments

  async getDeployments(
    _params?: { dir?: string },
  ): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }

  async getDeployment(_name: string): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }

  async postDeployment(_body: unknown): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }

  async patchDeployment(
    _name: string,
    _body: unknown,
  ): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }

  async deleteDeployment(_name: string): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }
}

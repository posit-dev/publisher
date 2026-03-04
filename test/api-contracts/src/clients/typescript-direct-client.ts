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

  // Inspection

  async postInspect(_params: {
    dir?: string;
    entrypoint?: string;
    recursive?: string;
  }): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }

  // Entrypoints

  async postEntrypoints(
    _params?: { dir?: string },
  ): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }

  // Files

  async getFiles(
    _params?: { pathname?: string },
  ): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }

  // Configuration sub-resources

  async getConfigFiles(
    _configName: string,
    _params?: { dir?: string },
  ): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }

  async postConfigFiles(
    _configName: string,
    _body: unknown,
  ): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }

  async getConfigSecrets(
    _configName: string,
    _params?: { dir?: string },
  ): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }

  async postConfigSecrets(
    _configName: string,
    _body: unknown,
  ): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }

  async getConfigPythonPackages(
    _configName: string,
    _params?: { dir?: string },
  ): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }

  async getConfigRPackages(
    _configName: string,
    _params?: { dir?: string },
  ): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }

  async getIntegrationRequests(
    _configName: string,
    _params?: { dir?: string },
  ): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }

  async postIntegrationRequest(
    _configName: string,
    _body: unknown,
  ): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }

  async deleteIntegrationRequest(
    _configName: string,
    _body: unknown,
  ): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }

  // Credentials (by GUID)

  async getCredential(_guid: string): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }

  // Interpreters

  async getInterpreters(
    _params?: { dir?: string },
  ): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }

  // Accounts

  async getAccounts(): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }

  async getAccount(_name: string): Promise<ContractResult> {
    throw new Error("Not implemented yet");
  }
}

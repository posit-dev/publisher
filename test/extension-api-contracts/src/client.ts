import type { CapturedRequest } from "./mock-publisher-server";

export type ExtensionContractStatus = "success" | "not_found" | "conflict" | "error";

export interface ExtensionContractResult<T = unknown> {
  status: ExtensionContractStatus;
  result: T;
  capturedRequests: CapturedRequest[];
}

export interface ExtensionContractClient {
  // Configurations
  getConfigurations(dir: string): Promise<ExtensionContractResult>;
  getConfiguration(name: string, dir: string): Promise<ExtensionContractResult>;
  createOrUpdateConfiguration(name: string, body: unknown, dir: string): Promise<ExtensionContractResult>;
  deleteConfiguration(name: string, dir: string): Promise<ExtensionContractResult>;

  // Credentials
  listCredentials(): Promise<ExtensionContractResult>;
  createCredential(body: unknown): Promise<ExtensionContractResult>;
  getCredential(guid: string): Promise<ExtensionContractResult>;
  deleteCredential(guid: string): Promise<ExtensionContractResult>;
  resetCredentials(): Promise<ExtensionContractResult>;
  testCredentials(url: string, insecure: boolean, apiKey?: string): Promise<ExtensionContractResult>;

  // Deployments
  getDeployments(dir: string): Promise<ExtensionContractResult>;
  getDeployment(id: string, dir: string): Promise<ExtensionContractResult>;
  createDeployment(dir: string, account?: string, config?: string, saveName?: string): Promise<ExtensionContractResult>;
  deleteDeployment(saveName: string, dir: string): Promise<ExtensionContractResult>;
  patchDeployment(name: string, dir: string, data: { configName?: string; guid?: string }): Promise<ExtensionContractResult>;
}

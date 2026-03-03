export type ResultStatus =
  | "ok"
  | "created"
  | "no_content"
  | "not_found"
  | "conflict";

export interface ContractResult<T = unknown> {
  status: ResultStatus;
  body: T; // parsed response body, or null for no_content
}

export interface BackendClient {
  // Configurations
  getConfigurations(params?: { dir?: string }): Promise<ContractResult>;
  getConfiguration(name: string): Promise<ContractResult>;
  putConfiguration(name: string, body: unknown): Promise<ContractResult>;
  deleteConfiguration(name: string): Promise<ContractResult>;

  // Credentials
  getCredentials(): Promise<ContractResult>;
  postCredential(body: unknown): Promise<ContractResult>;
  deleteCredential(guid: string): Promise<ContractResult>;
  resetCredentials(): Promise<ContractResult>;

  // Deployments
  getDeployments(params?: { dir?: string }): Promise<ContractResult>;
  getDeployment(name: string): Promise<ContractResult>;
  postDeployment(body: unknown): Promise<ContractResult>;
  patchDeployment(name: string, body: unknown): Promise<ContractResult>;
  deleteDeployment(name: string): Promise<ContractResult>;
}

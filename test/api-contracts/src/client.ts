export interface ContractResult<T = unknown> {
  status: number; // 200, 201, 204, 404, 409, etc.
  contentType: string; // "application/json" or ""
  body: T; // parsed JSON body, or null for 204
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

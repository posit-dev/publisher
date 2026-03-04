export type ResultStatus =
  | "ok"
  | "created"
  | "no_content"
  | "not_found"
  | "conflict"
  | "bad_request";

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

  // Inspection
  postInspect(params: {
    dir?: string;
    entrypoint?: string;
    recursive?: string;
  }): Promise<ContractResult>;

  // Entrypoints
  postEntrypoints(params?: { dir?: string }): Promise<ContractResult>;

  // Files
  getFiles(params?: { pathname?: string }): Promise<ContractResult>;

  // Configuration sub-resources
  getConfigFiles(configName: string, params?: { dir?: string }): Promise<ContractResult>;
  postConfigFiles(configName: string, body: unknown): Promise<ContractResult>;
  getConfigSecrets(configName: string, params?: { dir?: string }): Promise<ContractResult>;
  postConfigSecrets(configName: string, body: unknown): Promise<ContractResult>;
  getConfigPythonPackages(configName: string, params?: { dir?: string }): Promise<ContractResult>;
  getConfigRPackages(configName: string, params?: { dir?: string }): Promise<ContractResult>;
  getIntegrationRequests(configName: string, params?: { dir?: string }): Promise<ContractResult>;
  postIntegrationRequest(configName: string, body: unknown): Promise<ContractResult>;
  deleteIntegrationRequest(configName: string, body: unknown): Promise<ContractResult>;

  // Credentials (by GUID)
  getCredential(guid: string): Promise<ContractResult>;

  // Interpreters
  getInterpreters(params?: { dir?: string }): Promise<ContractResult>;

  // Accounts
  getAccounts(): Promise<ContractResult>;
  getAccount(name: string): Promise<ContractResult>;
}

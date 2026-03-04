import type { CapturedRequest } from "./mock-connect-server";

export type ConnectContractStatus = "success" | "error";

export interface ConnectContractResult<T = unknown> {
  status: ConnectContractStatus;
  result: T;
  capturedRequest: CapturedRequest | null;
  capturedRequests?: CapturedRequest[];
}

export interface ConnectContractClient {
  testAuthentication(params: {
    connectUrl: string;
    apiKey: string;
  }): Promise<ConnectContractResult>;

  getCurrentUser(params: {
    connectUrl: string;
    apiKey: string;
  }): Promise<ConnectContractResult>;

  createDeployment(params: {
    connectUrl: string;
    apiKey: string;
    body: unknown;
  }): Promise<ConnectContractResult>;

  contentDetails(params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
  }): Promise<ConnectContractResult>;

  updateDeployment(params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
    body: unknown;
  }): Promise<ConnectContractResult>;

  getEnvVars(params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
  }): Promise<ConnectContractResult>;

  setEnvVars(params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
    env: Record<string, string>;
  }): Promise<ConnectContractResult>;

  uploadBundle(params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
    bundleData: Uint8Array;
  }): Promise<ConnectContractResult>;

  deployBundle(params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
    bundleId: string;
  }): Promise<ConnectContractResult>;

  waitForTask(params: {
    connectUrl: string;
    apiKey: string;
    taskId: string;
  }): Promise<ConnectContractResult>;

  validateDeployment(params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
  }): Promise<ConnectContractResult>;

  getIntegrations(params: {
    connectUrl: string;
    apiKey: string;
  }): Promise<ConnectContractResult>;

  getSettings(params: {
    connectUrl: string;
    apiKey: string;
  }): Promise<ConnectContractResult>;

  latestBundleId(params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
  }): Promise<ConnectContractResult>;

  downloadBundle(params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
    bundleId: string;
  }): Promise<ConnectContractResult>;
}

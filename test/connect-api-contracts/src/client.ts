import type { CapturedRequest } from "./mock-connect-server";

export type ConnectContractStatus = "success" | "error";

export interface ConnectContractResult<T = unknown> {
  status: ConnectContractStatus;
  result: T;
  capturedRequest: CapturedRequest | null;
}

export interface ConnectContractClient {
  testAuthentication(params: {
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
}

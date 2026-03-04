import type { CapturedRequest } from "./mock-connect-server";

export type ConnectContractStatus = "success" | "error";

export interface ConnectContractResult<T = unknown> {
  status: ConnectContractStatus;
  result: T;
  capturedRequest: CapturedRequest | null;
  capturedRequests?: CapturedRequest[];
}

export interface ConnectContractClient {
  call(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<ConnectContractResult>;
}

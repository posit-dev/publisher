// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from "axios";

import { ContentRecord, Environment } from "../types/contentRecords";
import type { PositronSettings } from "../types/positron";
import { PythonExecutable, RExecutable } from "../../types/shared";

export class ContentRecords {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  // Returns:
  // 200 - success
  // 400 - bad request
  // 500 - internal server error
  // Errors returned through event stream
  publish(
    targetName: string,
    accountName: string,
    configName: string,
    insecure: boolean,
    dir: string,
    r: RExecutable | undefined,
    python: PythonExecutable | undefined,
    secrets?: Record<string, string>,
    positron?: PositronSettings,
  ) {
    const data = {
      account: accountName,
      config: configName,
      secrets: secrets,
      insecure: insecure,
      positron,
    };
    const encodedTarget = encodeURIComponent(targetName);
    return this.client.post<{ localId: string }>(
      `deployments/${encodedTarget}`,
      data,
      {
        params: {
          dir,
          r: r !== undefined ? r.rPath : "",
          python: python !== undefined ? python.pythonPath : "",
        },
      },
    );
  }

  getEnv(deploymentName: string, dir: string) {
    const encodedName = encodeURIComponent(deploymentName);
    return this.client.get<Environment>(
      `deployments/${encodedName}/environment`,
      {
        params: {
          dir,
        },
      },
    );
  }

  // Returns:
  // 200 - success
  // 404 - not found
  // 500 - internal server error
  cancelDeployment(deploymentName: string, dir: string, localId: string) {
    const encodedName = encodeURIComponent(deploymentName);
    const encodedLocalId = encodeURIComponent(localId);
    return this.client.post<ContentRecord>(
      `deployments/${encodedName}/cancel/${encodedLocalId}`,
      {},
      {
        params: {
          dir,
        },
      },
    );
  }
}

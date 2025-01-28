// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from "axios";

import { ContentRecordFile, FileAction } from "../types/files";
import { Configuration } from "../types/configurations";
import { PythonExecutable, RExecutable } from "../../types/shared";

export class Files {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  // Returns:
  // 200 - success
  // 403 - pathname is not safe - forbidden
  // 500 - internal server error
  get() {
    return this.client.get<ContentRecordFile>("/files");
  }

  // Returns:
  // 200 - success
  // 400 - configuration is invalid
  // 404 - configuration does not exist
  // 422 - configuration files list contains invalid patterns
  // 500 - internal server error
  getByConfiguration(
    configName: string,
    dir: string,
    r: RExecutable,
    python: PythonExecutable,
  ) {
    const encodedName = encodeURIComponent(configName);
    return this.client.get<ContentRecordFile>(
      `/configurations/${encodedName}/files`,
      {
        params: {
          dir,
          python: python.pythonPath,
          r: r.rPath,
        },
      },
    );
  }

  updateFileList(
    configName: string,
    path: string,
    action: FileAction,
    dir: string,
  ) {
    const encodedName = encodeURIComponent(configName);
    const body = {
      path,
      action,
    };
    return this.client.post<Configuration>(
      `/configurations/${encodedName}/files`,
      body,
      { params: { dir } },
    );
  }
}

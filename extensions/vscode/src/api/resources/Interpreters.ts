// Copyright (C) 2025 by Posit Software, PBC.

import { AxiosInstance } from "axios";

import { PythonExecutable, RExecutable } from "../../types/shared";
import { InterpreterDefaults } from "../types/interpreters";

export class Interpreters {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  // Returns:
  // 200 - success
  // 500 - internal server error
  get(
    dir: string,
    r: RExecutable | undefined,
    python: PythonExecutable | undefined,
  ) {
    return this.client.get<InterpreterDefaults>(`/interpreters`, {
      params: {
        dir,
        r: r !== undefined ? r.rPath : "",
        python: python !== undefined ? python.pythonPath : "",
      },
    });
  }
}

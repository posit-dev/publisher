// Copyright (C) 2024 by Posit Software, PBC.

import * as vscode from "vscode";

import { HOST } from ".";
import { Server } from "./servers";
import { useApi } from "./api";

export class Service implements vscode.Disposable {
  private context: vscode.ExtensionContext;
  private server: Server;
  private agentURL: string;

  constructor(context: vscode.ExtensionContext, port: number) {
    this.context = context;
    this.agentURL = `http://${HOST}:${port}/api`;
    this.server = new Server(port);
    useApi().setBaseUrl(this.agentURL);
  }

  start = async () => {
    await this.server.start(this.context);
  };

  isUp = () => {
    return this.server.isUp();
  };

  stop = async () => {
    await this.server.stop();
    this.server.dispose();
  };

  dispose() {
    this.server.dispose();
  }
}

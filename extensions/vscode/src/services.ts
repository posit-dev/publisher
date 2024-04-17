// Copyright (C) 2024 by Posit Software, PBC.

import { HOST } from ".";
import { Server } from "./servers";
import { initApi } from "./api";
import { ExtensionContext, Disposable } from "vscode";

export class Service implements Disposable {
  private context: ExtensionContext;
  private server: Server;
  private agentURL: string;

  constructor(context: ExtensionContext, port: number) {
    this.context = context;
    this.agentURL = `http://${HOST}:${port}/api`;
    this.server = new Server(port);
    initApi(this.isUp(), this.agentURL);
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

// Copyright (C) 2024 by Posit Software, PBC.

import { ExtensionContext, Disposable, ExtensionMode } from "vscode";

import { HOST } from "src";
import { initApi } from "src/api";
import { Server } from "src/servers";

export class Service implements Disposable {
  private context: ExtensionContext;
  private server: Server;
  private agentURL: string;
  private useExternalAgent: boolean;

  constructor(context: ExtensionContext, port: number) {
    this.context = context;
    this.useExternalAgent =
      context.extensionMode === ExtensionMode.Development &&
      process.env.POSIT_PUBLISHER_USE_EXTERNAL_AGENT === "TRUE";
    console.log(
      "Starting Context in extension mode: %s, with useExternalAgent set to %s",
      this.context.extensionMode,
      this.useExternalAgent,
    );

    if (this.useExternalAgent) {
      port = 9001;
    }
    this.agentURL = `http://${HOST}:${port}/api`;
    this.server = new Server(port);
    initApi(this.isUp(), this.agentURL);
  }

  start = async () => {
    if (!this.useExternalAgent) {
      await this.server.start(this.context);
    }
  };

  isUp = () => {
    return this.server.isUp();
  };

  stop = async () => {
    if (!this.useExternalAgent) {
      await this.server.stop();
      this.server.dispose();
    }
  };

  dispose() {
    this.server.dispose();
  }

  showOutputChannel() {
    if (this.server) {
      this.server.outputChannel.show();
    }
  }
}

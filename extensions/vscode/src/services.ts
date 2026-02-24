// Copyright (C) 2024 by Posit Software, PBC.

import { ExtensionContext, Disposable } from "vscode";

import { HOST } from "src";
import { initApi } from "src/api";
import { logger } from "src/logging";
import { Server } from "src/servers";
import { createCredentialsService } from "src/services/credentials";

export class Service implements Disposable {
  private context: ExtensionContext;
  private server: Server;
  private agentURL: string;
  private useExternalAgent: boolean;
  private useKeyChain: boolean;

  constructor(
    context: ExtensionContext,
    port: number,
    useExternalAgent: boolean,
    useKeyChain: boolean,
  ) {
    this.context = context;
    this.useExternalAgent = useExternalAgent;
    this.useKeyChain = useKeyChain;

    this.agentURL = `http://${HOST}:${port}/api`;
    this.server = new Server(port, this.useKeyChain);

    // Create a promise for the native credentials service
    // This is resolved lazily when credentials.list() is called
    const credentialsServicePromise = createCredentialsService(
      context.secrets,
      useKeyChain,
    )
      .then((service) => {
        logger.info("Native credentials service initialized");
        return service;
      })
      .catch((error) => {
        logger.warn("Failed to initialize native credentials service", error);
        return undefined;
      });

    initApi(this.isUp(), this.agentURL, credentialsServicePromise);
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
    logger.show();
  }
}

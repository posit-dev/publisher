// Copyright (C) 2024 by Posit Software, PBC.

import { ExtensionContext, Disposable } from "vscode";

import { logger } from "src/logging";
import { Server } from "src/servers";

export class Service implements Disposable {
  private context: ExtensionContext;
  private server: Server;
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

    this.server = new Server(port, this.useKeyChain);
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

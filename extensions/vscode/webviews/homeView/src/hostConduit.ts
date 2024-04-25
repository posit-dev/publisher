// Copyright (C) 2024 by Posit Software, PBC.

import {
  ConduitMessage,
  isConduitMessage,
  ConduitCB,
} from "../../../src/messages";
import { WebviewApi } from "vscode-webview";

export class HostConduit {
  private externalMsgCB: ConduitCB | undefined = undefined;

  constructor(
    private readonly window: Window,
    private readonly vsCodeApi: WebviewApi<unknown>,
  ) {}

  private rawMsgCB = (e: any) => {
    if (this.externalMsgCB) {
      const obj = JSON.parse(e);
      if (isConduitMessage(obj)) {
        this.externalMsgCB(obj);
      } else {
        throw new Error(`NonConduitMessage Received: ${JSON.stringify(e)}`);
      }
    }
  };

  public onMsg = (cb: ConduitCB) => {
    this.externalMsgCB = cb;
    this.window.addEventListener("message", this.rawMsgCB);
  };

  public deactivate() {
    this.window.removeEventListener("message", this.rawMsgCB);
  }

  public sendMsg = (msg: ConduitMessage) => {
    const e = JSON.stringify(msg);
    this.vsCodeApi.postMessage(e);
  };
}

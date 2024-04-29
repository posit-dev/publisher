// Copyright (C) 2024 by Posit Software, PBC.

import { HostToWebviewMessageCB } from "../../../src/types/messages/conduit";
import { WebviewApi } from "vscode-webview";
import { isHostToWebviewMessage } from "../../../src/types/messages/hostToWebviewMessages";
import { WebviewToHostMessage } from "../../../src/types/messages/webviewToHostMessages";

// A HostConduit is used by a webview to connect to a host
// a webview sends WebviewToHostMessage
// and receives HostToWebviewMessage

export class HostConduit {
  private externalMsgCB: HostToWebviewMessageCB | undefined = undefined;

  constructor(
    private readonly window: Window,
    private readonly vsCodeApi: WebviewApi<unknown>,
  ) {}

  private rawMsgCB = (e: any) => {
    if (this.externalMsgCB) {
      const obj = JSON.parse(e.data);
      if (isHostToWebviewMessage(obj)) {
        this.externalMsgCB(obj);
      } else {
        throw new Error(`NonConduitMessage Received: ${JSON.stringify(e)}`);
      }
    }
  };

  public onMsg = (cb: HostToWebviewMessageCB) => {
    this.externalMsgCB = cb;
    this.window.addEventListener("message", this.rawMsgCB);
  };

  public deactivate() {
    this.window.removeEventListener("message", this.rawMsgCB);
  }

  public sendMsg = (msg: WebviewToHostMessage) => {
    const e = JSON.stringify(msg);
    this.vsCodeApi.postMessage(e);
  };
}

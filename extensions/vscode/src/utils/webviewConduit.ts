// Copyright (C) 2024 by Posit Software, PBC.

import { Webview, Disposable, window } from "vscode";
import { WebviewToHostMessageCB } from "../types/messages/conduit";
import { isWebviewToHostMessage } from "../types/messages/webviewToHostMessages";
import { HostToWebviewMessage } from "../types/messages/hostToWebviewMessages";

// A WebviewConduit is used by a "host" to connect to a webview
// a host sends: HostToWebviewMessage
// and receives: WebviewToHostMessage

export class WebviewConduit {
  private target: Webview | undefined;
  private onMsgCB: WebviewToHostMessageCB | undefined;
  private pendingMsgs: HostToWebviewMessage[] = [];

  constructor() {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onRawMsgCB = (e: any) => {
    const obj = JSON.parse(e);
    // console.debug(
    //   `\nWebviewConduit trace: ${obj.kind}: ${JSON.stringify(obj.content)}`,
    // );
    if (!isWebviewToHostMessage(obj)) {
      const msg = `Internal Error: WebviewConduit::onRawMsgCB - NonConduitMessage Received: ${JSON.stringify(e)}`;
      window.showErrorMessage(msg);
      return;
    }
    if (this.onMsgCB) {
      this.onMsgCB(obj);
    } else {
      const msg = `Internal Error: WebviewConduit::onRawMsgCB - onMsg callback not set ahead of receiving message: ${JSON.stringify(e)}`;
      window.showErrorMessage(msg);
      return;
    }
  };

  public init = (target: Webview) => {
    if (this.target) {
      // we are in the process of replacing the target. That means we're going to be re-registering
      // a new callback, so we need to reset a bit.
      // It would be great if we knew about this sooner, but this works for now.
      this.onMsgCB = undefined;
    }
    this.target = target;

    // send any messages which were queued up awaiting initialization
    this.pendingMsgs.forEach((msg) => this.sendMsg(msg));
    this.pendingMsgs = [];
  };

  public onMsg = (cb: WebviewToHostMessageCB): Disposable | undefined => {
    if (!this.target) {
      window.showErrorMessage(
        "Internal Error: WebviewConduit::onMsg called before webview reference established with init().",
      );
      return undefined;
    }
    if (this.onMsgCB) {
      window.showErrorMessage(
        "Internal Error: WWebviewConduit::onMsg called an unexpected second time",
      );
      return undefined;
    }
    this.onMsgCB = cb;
    return this.target.onDidReceiveMessage(this.onRawMsgCB);
  };

  public sendMsg = (msg: HostToWebviewMessage) => {
    // don't send messages if the Webview hasn't initialized yet
    if (!this.target) {
      return;
    }
    const e = JSON.stringify(msg);
    this.target.postMessage(e);
  };
}

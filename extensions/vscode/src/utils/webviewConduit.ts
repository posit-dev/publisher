// Copyright (C) 2024 by Posit Software, PBC.

import { Webview, Disposable } from "vscode";
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

  private onRawMsgCB = (e: any) => {
    const obj = JSON.parse(e);
    console.debug(
      `\nWebviewConduit trace: ${obj.kind}: ${JSON.stringify(obj.content)}`,
    );
    if (!isWebviewToHostMessage(obj)) {
      const msg = `\nNonConduitMessage Received: ${JSON.stringify(e)}\n`;

      throw new Error(msg);
    }
    if (this.onMsgCB) {
      this.onMsgCB(obj);
    } else {
      const msg = `onMsg callback not set ahead of receiving message: ${JSON.stringify(e)}`;
      console.error(msg);
      throw new Error(msg);
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

  public onMsg = (cb: WebviewToHostMessageCB): Disposable => {
    if (!this.target) {
      throw new Error(
        `WebviewConduit::onMsg called before webview reference established with init().`,
      );
    }
    if (this.onMsgCB) {
      throw new Error(`WebviewConduit::onMsg called a second time!`);
    }
    this.onMsgCB = cb;
    return this.target.onDidReceiveMessage(this.onRawMsgCB);
  };

  public sendMsg = (msg: HostToWebviewMessage) => {
    const e = JSON.stringify(msg);
    if (!this.target) {
      console.warn(
        `Warning: WebviewConduit::sendMsg queueing up msg called before webview reference established with init(): ${e}`,
      );
      this.pendingMsgs.push(msg);
      return;
    }
    this.target.postMessage(e);
  };
}

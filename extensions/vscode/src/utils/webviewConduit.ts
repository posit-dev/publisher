// Copyright (C) 2024 by Posit Software, PBC.

import { Webview, Disposable } from "vscode";
import { WebviewToHostMessageCB } from "../types/messages/conduit";
import { isWebviewToHostMessage } from "../types/messages/webviewToHostMessages";
import { HostToWebviewMessage } from "../types/messages/hostToWebviewMessages";

// A WebviewConduit is used by a "host" to connect to a webview
// a host sends: HostToWebviewMessage
// and receives: WebviewToHostMessage

export class WebviewConduit {
  private _target: Webview | undefined;
  private _onMsgCB: WebviewToHostMessageCB | undefined;
  private pendingMsgs: HostToWebviewMessage[] = [];

  constructor() {}

  private _onRawMsgCB = (e: any) => {
    const obj = JSON.parse(e);
    console.debug(
      `\nWebviewConduit trace: ${obj.kind}: ${JSON.stringify(obj.content)}`,
    );
    if (!isWebviewToHostMessage(obj)) {
      throw new Error(`NonConduitMessage Received: ${JSON.stringify(e)}`);
    }
    if (this._onMsgCB) {
      this._onMsgCB(obj);
    } else {
      throw new Error(
        `onMsg callback not set ahead of receiving message: ${JSON.stringify(e)}`,
      );
    }
  };

  public init = (target: Webview) => {
    if (this._target) {
      // we are in the process of replacing the target. That means we're going to be re-registering
      // a new callback, so we need to reset a bit.
      // It would be great if we knew about this sooner, but this works for now.
      this._onMsgCB = undefined;
    }
    this._target = target;

    // send any messages which were queued up awaiting initialization
    this.pendingMsgs.forEach((msg) => this.sendMsg(msg));
    this.pendingMsgs = [];
  };

  public onMsg = (cb: WebviewToHostMessageCB): Disposable => {
    if (!this._target) {
      throw new Error(
        `WebviewConduit::onMsg called before webview reference established with init().`,
      );
    }
    if (this._onMsgCB) {
      throw new Error(`WebviewConduit::onMsg called a second time!`);
    }
    this._onMsgCB = cb;
    return this._target.onDidReceiveMessage(this._onRawMsgCB);
  };

  public sendMsg = (msg: HostToWebviewMessage) => {
    const e = JSON.stringify(msg);
    if (!this._target) {
      console.warn(
        `Warning: WebviewConduit::sendMsg queueing up msg called before webview reference established with init(): ${e}`,
      );
      this.pendingMsgs.push(msg);
      return;
    }
    this._target.postMessage(e);
  };
}

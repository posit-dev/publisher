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

  constructor() {}

  private _onRawMsgCB = (e: any) => {
    const obj = JSON.parse(e);
    console.log(`Received msg kind: ${obj.kind}`);
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
    this._target = target;
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
      throw new Error(
        `WebviewConduit::sendMsg called before webview reference established with init(). msg`,
      );
    }
    this._target.postMessage(e);
  };
}

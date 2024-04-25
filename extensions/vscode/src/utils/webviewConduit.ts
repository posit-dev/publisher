// Copyright (C) 2024 by Posit Software, PBC.

import { Webview, Disposable } from "vscode";
import { ConduitMessage, isConduitMessage, ConduitCB } from "../messages";

export class WebviewConduit {
  private _target: Webview | undefined;
  private _onMsgCB: ConduitCB | undefined;

  public disposables: Disposable[] = [];

  constructor() {}

  private _onRawMsgCB = (e: any) => {
    const obj = JSON.parse(e);
    if (!isConduitMessage(obj)) {
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
    this.disposables.push(this._target?.onDidReceiveMessage(this._onRawMsgCB));
  };

  public onMsg = (cb: ConduitCB): Disposable => {
    if (!this._target) {
      throw new Error(
        "WebviewConduit::onMsg called before webview reference established with init()",
      );
    }
    return this._target.onDidReceiveMessage((e: any) => {
      const obj = JSON.parse(e);
      if (isConduitMessage(obj)) {
        cb(obj);
      } else {
        throw new Error(
          `NonConduitMessage Received in WebviewConduit::onMsg: ${JSON.stringify(e)}`,
        );
      }
    });
  };

  public sendMsg = (msg: ConduitMessage) => {
    const e = JSON.stringify(msg);
    if (!this._target) {
      throw new Error(
        `WebviewConduit::sendMsg called before webview reference established with init(). msg = ${e}`,
      );
    }
    this._target.postMessage(e);
  };
}

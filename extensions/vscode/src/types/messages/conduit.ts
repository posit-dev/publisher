// Copyright (C) 2024 by Posit Software, PBC.

import {
  HostToWebviewMessage,
  HostToWebviewMessageType,
  isHostToWebviewMessage,
} from "./hostToWebviewMessages";
import {
  WebviewToHostMessage,
  WebviewToHostMessageType,
  isWebviewToHostMessage,
} from "./webviewToHostMessages";

export type MessageType = WebviewToHostMessageType | HostToWebviewMessageType;

export type ConduitMessage = HostToWebviewMessage | WebviewToHostMessage;

export function isConduitMessage(msg: any): msg is ConduitMessage {
  return isHostToWebviewMessage(msg) || isWebviewToHostMessage(msg);
}

export type WebviewToHostMessageCB = (msg: WebviewToHostMessage) => void;
export type HostToWebviewMessageCB = (msg: HostToWebviewMessage) => void;

// Copyright (C) 2024 by Posit Software, PBC.

import {
  HostToWebviewMessage,
  HostToWebviewMessageType,
} from "./hostToWebviewMessages";
import {
  WebviewToHostMessage,
  WebviewToHostMessageType,
} from "./webviewToHostMessages";

export type MessageType = WebviewToHostMessageType | HostToWebviewMessageType;

export type ConduitMessage = HostToWebviewMessage | WebviewToHostMessage;

export type WebviewToHostMessageCB = (msg: WebviewToHostMessage) => void;
export type HostToWebviewMessageCB = (msg: HostToWebviewMessage) => void;

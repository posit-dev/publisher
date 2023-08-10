// Copyright (C) 2023 by Posit Software, PBC.

export enum EventSourceReadyState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSED = 2,
}

export type ServerMessage = {
  msgType: string,
  msgData: string,
}

export type OnOpenEventSourceCallback = () => void;
export type OnErrorEventSourceCallback = (e: Event) => void;
export type OnMessageEventSourceCallback = (msg: MessageEvent<ServerMessage>) => boolean;

export type MethodResult = {
  ok: boolean,
  error?: string,
}

export type EventStatus = {
  isOpen: boolean | undefined,
  eventSource: string,
  withCredentials: boolean | undefined,
  readyState: EventSourceReadyState | undefined,
  url: string | null,
  lastError: Event | null,
}

export type MockMessage = {
  type: string,
  data: string,
}

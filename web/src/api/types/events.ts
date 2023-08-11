// Copyright (C) 2023 by Posit Software, PBC.

export enum EventSourceReadyState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSED = 2,
}

export const isSomeStringEnum =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <T>(e: T) => (token: any): token is T[keyof T] => Object.values(e).includes(token as T[keyof T]);

export enum EventStreamMessageTypes {
  ERROR = 'error',
  LOG = 'log',
}

export type EventStreamMessage = {
  type: EventStreamMessageTypes,
  time: string,
  data: string,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isEventStreamMessage(o: any): o is EventStreamMessage {
  return (
    'type' in o && isSomeStringEnum(EventStreamMessageTypes)(o.type) &&
    'time' in o &&
    'data' in o
  );
}

export type OnOpenEventSourceCallback = () => void;
export type OnErrorEventSourceCallback = (msg: string) => void;
export type OnMessageEventSourceCallback = (msg: EventStreamMessage) => boolean;

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
  lastError: string | null,
}

export type MockMessage = {
  type: string,
  data: string,
}

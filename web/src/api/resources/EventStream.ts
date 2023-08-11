// Copyright (C) 2023 by Posit Software, PBC.

import {
  OnOpenEventSourceCallback,
  OnErrorEventSourceCallback,
  OnMessageEventSourceCallback,
  MethodResult,
  EventStatus,
  MockMessage,
  EventStreamMessage,
  isEventStreamMessage,
} from 'src/api/types/events';

export type OurMessageEvent = {
  data: string,
}

export class EventStream {
  private mockMessages = <MockMessage[] | null>null;
  private mockingActive = false;
  private eventSource = <EventSource | null>null;
  private isOpen = false;
  private lastError = <string | null>null;
  private debugEnabled = false;

  private openCallbacks = <OnOpenEventSourceCallback[]>[];
  private errorCallbacks = <OnErrorEventSourceCallback[]>[];
  private messageCallbacks = <OnMessageEventSourceCallback[]>[];

  private logMsg(msg: string) {
    if (this.debugEnabled) {
      console.log(`DEBUG: ${msg}`);
    }
  }

  private logError(msg: string, error: MethodResult) : MethodResult {
    this.logMsg(`${msg}: error = ${error?.error}`);
    return error;
  }

  private onRawOpenCallback() {
    this.logMsg(`received RawOpenCallback`);
    this.isOpen = true;
    this.openCallbacks.forEach(cb => cb());
  }

  private onErrorRawCallback(e) {
    // errors are fatal, connection is down.
    // not receiving anything of value from calling parameters. only : {"isTrusted":true}
    this.logMsg(`received ErrorRawCallback: ${JSON.stringify(e)}`);
    this.isOpen = false;
    this.lastError = `unknown error with connection ${Date.now()}`;
    this.errorCallbacks.forEach(cb => cb(this.lastError));
  }

  private onMessageRawCallback(msg: MessageEvent) {
    this.logMsg(`received MessageRawCallback (for real): ${msg.data}`);
    const parsed: EventStreamMessage = JSON.parse(msg.data);
    if (!isEventStreamMessage(parsed)) {
      const errorMsg = `Invalid EventStreamMessage received: ${msg.data}`;
      this.errorCallbacks.forEach(cb => cb(errorMsg));
      return;
    }
    // we will stop propogation if the callback returns false;
    this.messageCallbacks.every(cb => cb(parsed));
  }

  private initializeConnection(url: string, withCredentials: boolean): MethodResult {
    if (!this.mockingActive) {
      this.logMsg(`initializing non-mocking connection to ${url}, with credentials: ${withCredentials}`);
      this.eventSource = new EventSource(url, { withCredentials: withCredentials });
      this.eventSource.onopen = () => this.onRawOpenCallback();
      // nothing good seems to come with the error data. Only get {"isTrusted":true}
      this.eventSource.onerror = (e) => this.onErrorRawCallback(e);
      this.eventSource.onmessage = (msg: MessageEvent) => this.onMessageRawCallback(msg);
    } else if (this.mockMessages) {
      this.logMsg(`initializing mocked connection to ${url}, with credentials: ${withCredentials}, loading ${this.mockMessages.length} messages`);
      this.mockMessages.forEach(msg => {
        this.onMessageRawCallback(new MessageEvent('message', { data: msg.data }));
      });
    }
    return {
      ok: true,
    };
  }

  public open(url: string, withCredentials = false): MethodResult {
    this.logMsg(`opening connection ${url}, with credentials: ${withCredentials}}`);
    if (this.isOpen) {
      return this.logError(
        `failure opening connection`,
        {
          ok: false,
          error: `EventStream instance has already been initialized to ${url}.`,
        }
      );
    }
    if (!url) {
      return this.logError(
        `failure opening connection`,
        {
          ok: false,
          error: `URL parameter must be a non-empty string.`,
        }
      );
    }
    return this.initializeConnection(url, withCredentials);
  }

  public close(): MethodResult {
    if (this.isOpen && !this.mockingActive && this.eventSource !== null) {
      this.eventSource.close();
      this.eventSource = null;
      this.isOpen = false;
      return {
        ok: true,
      };
    }
    return this.logError(
      `failure closing connection`,
      {
        ok: false,
        error: `EventSource is not open.`,
      }
    );
  }

  public addOpenEventCallback(cb: OnOpenEventSourceCallback) {
    this.openCallbacks.push(cb);
    this.logMsg(`adding OpenEventCallback: ${cb}`);
  }

  public addErrorEventCallback(cb: OnErrorEventSourceCallback) {
    this.errorCallbacks.push(cb);
    this.logMsg(`adding ErrorEventCallback: ${cb}`);
  }

  public addMessageEventCallback(cb: OnMessageEventSourceCallback) {
    this.messageCallbacks.push(cb);
    this.logMsg(`adding MessageEventCallback: ${cb}`);
  }

  public status() : EventStatus {
    return {
      withCredentials: this.eventSource?.withCredentials,
      readyState: this.eventSource?.readyState,
      url: this.eventSource ? this.eventSource.url : null,
      lastError: this.lastError,
      isOpen: this.isOpen,
      eventSource: this.eventSource ? 'eventSource has been initialized' : 'eventSource not yet initialized',
    };
  }

  public setDebugMode(val: boolean) {
    this.debugEnabled = val;
    if (val) {
      this.logMsg(`debug logging is enabled!`);
    }
  }

  public pushMockMessage(msg: MockMessage) : MethodResult {
    if (this.eventSource !== null) {
      return this.logError(
        `pushMockMessage`,
        {
          ok: false,
          error: `Unable to push mock message when EventSource is not null (and active).`,
        }
      );
    }
    this.mockingActive = true;
    this.onMessageRawCallback(new MessageEvent(msg.type, { data: msg.data }));
    return {
      ok: true,
    };
  }
}

// Copyright (C) 2023 by Posit Software, PBC.

import {
  OnMessageEventSourceCallback,
  MethodResult,
  EventStatus,
  MockMessage,
  EventStreamMessage,
  isEventStreamMessage,
  EventSubscriptionTargets,
} from 'src/api/types/events';

export type OurMessageEvent = {
  data: string,
}

export type CallbackQueueEntry = {
  eventType: EventSubscriptionTargets,
  callback: OnMessageEventSourceCallback,
}

export class EventStream {
  private mockMessages = <MockMessage[] | null>null;
  private mockingActive = false;
  private eventSource = <EventSource | null>null;
  private isOpen = false;
  private lastError = <string | null>null;
  private debugEnabled = false;

  private subscriptions = <CallbackQueueEntry[]>[];

  private logMsg(msg: string) {
    if (this.debugEnabled) {
      console.log(`DEBUG: ${msg}`);
    }
  }

  private logError(msg: string, error: MethodResult) : MethodResult {
    this.logMsg(`${msg}: error = ${error?.error}`);
    return error;
  }

  private matchEvent(
    subscriptionType: EventSubscriptionTargets,
    incomingEventType: EventSubscriptionTargets
  ) {
    console.log(`MatchEvent: subscription type: ${subscriptionType}, incomingType: ${incomingEventType}`);
    if (subscriptionType.indexOf('*') === 0) {
      console.log('matched on *');
      return true;
    }
    const wildCardIndex = subscriptionType.indexOf('/*');
    if (wildCardIndex > 0 && subscriptionType.length === wildCardIndex + 2) {
      const basePath = subscriptionType.substring(0, wildCardIndex);
      if (incomingEventType.indexOf(basePath) === 0) {
        console.log('matched on start of string');
        return true;
      }
    }
    const globIndex = subscriptionType.indexOf('/**/');
    if (globIndex > 0) {
      const parts = subscriptionType.split('/**/');
      if (
        incomingEventType.indexOf(parts[0]) === 0 &&
        incomingEventType.indexOf(parts[1]) === incomingEventType.length - parts[1].length
      ) {
        console.log('matched on glob');
        return true;
      }
    }

    // no wild-card. Must match exactly
    console.log(`matching on exact string: ${subscriptionType === incomingEventType}`);
    return subscriptionType === incomingEventType;
  }

  private dispatchMessage(msg: EventStreamMessage) {
    let numMatched = 0;
    this.subscriptions.forEach(entry => {
      if (this.matchEvent(entry.eventType, msg.type)) {
        numMatched++;
        entry.callback(msg);
      }
    });
    if (numMatched === 0) {
      this.dispatchMessage({
        type: 'errors/unknownEvent',
        time: new Date().toString(),
        data: {
          event: msg,
        },
      });
    }
  }

  private onRawOpenCallback() {
    this.logMsg(`received RawOpenCallback`);
    this.isOpen = true;
    this.dispatchMessage({
      type: 'open/sse',
      time: new Date().toString(),
      data: {},
    });
  }

  private onErrorRawCallback(e: Event) {
    // errors are fatal, connection is down.
    // not receiving anything of value from calling parameters. only : {"isTrusted":true}
    this.logMsg(`received ErrorRawCallback: ${JSON.stringify(e)}`);
    this.isOpen = false;
    this.lastError = `unknown error with connection ${Date.now()}`;
    const now = new Date();
    this.dispatchMessage({
      type: 'errors/open',
      time: now.toString(),
      data: `{ msg: ${this.lastError} }`,
    });
  }

  private onMessageRawCallback(msg: MessageEvent) {
    this.logMsg(`received MessageRawCallback (for real): ${msg.data}`);
    const parsed: EventStreamMessage = JSON.parse(msg.data);
    if (!isEventStreamMessage(parsed)) {
      const errorMsg = `Invalid EventStreamMessage received: ${msg.data}`;
      const now = new Date();
      this.dispatchMessage({
        type: 'errors/open',
        time: now.toString(),
        data: `{ msg: "${errorMsg}" }`,
      });
      return;
    }
    this.dispatchMessage(parsed);
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

  public addEventMonitorCallback(
    target: EventSubscriptionTargets,
    cb: OnMessageEventSourceCallback
  ) {
    this.subscriptions.push({
      eventType: target,
      callback: cb,
    });
  }

  public delEventFilterCallback(cb: OnMessageEventSourceCallback) {
    const index = this.subscriptions.findIndex(entry => entry.callback === cb);
    if (index >= 0) {
      this.subscriptions.splice(index, 1);
      return true;
    }
    return false;
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

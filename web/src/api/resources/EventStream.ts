// Copyright (C) 2023 by Posit Software, PBC.

import camelcaseKeys from 'camelcase-keys';

import {
  OnMessageEventSourceCallback,
  MethodResult,
  EventStatus,
  EventStreamMessage,
  isEventStreamMessage,
  EventSubscriptionTarget,
  CallbackQueueEntry,
} from 'src/api/types/events.ts';

export class EventStream {
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

  private logError(msg: string, error: MethodResult): MethodResult {
    this.logMsg(`${msg}: error = ${error?.error}`);
    return error;
  }

  private matchEvent(
    subscriptionType: EventSubscriptionTarget,
    incomingEventType: EventSubscriptionTarget
  ) {
    this.logMsg(`MatchEvent: subscription type: ${subscriptionType}, incomingType: ${incomingEventType}`);
    if (subscriptionType.indexOf('*') === 0) {
      this.logMsg('matched on *');
      return true;
    }
    const wildCardIndex = subscriptionType.indexOf('/*');
    // Does the wildcard live at the very end of the subscription type?
    if (wildCardIndex > 0 && subscriptionType.length === wildCardIndex + 2) {
      const basePath = subscriptionType.substring(0, wildCardIndex);
      if (incomingEventType.indexOf(basePath) === 0) {
        this.logMsg('matched on start of string');
        return true;
      }
    }
    // Are we using a glob, which is meant to be in the middle of two strings
    // which need to be matched
    const globIndex = subscriptionType.indexOf('/**/');
    if (globIndex > 0) {
      // split our subscription type string into two parts (before and after the glob characters)
      const parts = subscriptionType.split('/**/');
      // to match, we must make sure we find that the incoming event type starts
      // exactly with our first part and ends with exactly our second part, regardless of how
      // many characters in the incoming event type are "consumed" by our glob query.
      if (
        incomingEventType.indexOf(parts[0]) === 0 &&
        incomingEventType.indexOf(parts[1]) === incomingEventType.length - parts[1].length
      ) {
        this.logMsg('matched on glob');
        return true;
      }
    }

    // no wild-card. Must match exactly
    this.logMsg(`attempt to match on exact string. Result = ${subscriptionType === incomingEventType}`);
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
    if (numMatched === 0 && msg.type !== 'errors/open') {
      this.logMsg(`WARNING! No subscriber/handler found for msg: ${JSON.stringify}`);
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
      data: { msg: `${this.lastError}` },
    });
  }

  private parseMessageData(data: string) : EventStreamMessage | null {
    const rawObj = JSON.parse(data);
    const obj = camelcaseKeys(rawObj);
    if (isEventStreamMessage(obj)) {
      return obj;
    }
    return null;
  }

  private onMessageRawCallback(msg: MessageEvent) {
    this.logMsg(`received MessageRawCallback (for real): ${msg.data}`);
    const parsed = this.parseMessageData(msg.data);
    if (!parsed) {
      const errorMsg = `Invalid EventStreamMessage received: ${msg.data}`;
      const now = new Date();
      this.dispatchMessage({
        type: 'errors/open',
        time: now.toString(),
        data: { msg: `${errorMsg}` },
      });
      return;
    }
    this.logMsg(`Received event type = ${parsed.type}`);
    this.dispatchMessage(parsed);
  }

  private initializeConnection(url: string, withCredentials: boolean): MethodResult {
    this.logMsg(`initializing connection to ${url}, with credentials: ${withCredentials}`);
    this.eventSource = new EventSource(url, { withCredentials: withCredentials });
    this.eventSource.onopen = () => this.onRawOpenCallback();
    // nothing good seems to come with the error data. Only get {"isTrusted":true}
    this.eventSource.onerror = (e) => this.onErrorRawCallback(e);
    this.eventSource.onmessage = (msg: MessageEvent) => this.onMessageRawCallback(msg);
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
    if (this.isOpen && this.eventSource !== null) {
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
    targets: EventSubscriptionTarget[],
    cb: OnMessageEventSourceCallback
  ) {
    for (const t in targets) {
      this.subscriptions.push({
        eventType: targets[t],
        callback: cb,
      });
    }
  }

  public delEventFilterCallback(cb: OnMessageEventSourceCallback) {
    let found = false;
    let index = -1;
    // We may have multiple events being delivered to same callback
    // so we have to search until we do not find anything
    do {
      index = this.subscriptions.findIndex(entry => entry.callback === cb);
      if (index >= 0) {
        this.subscriptions.splice(index, 1);
        found = true;
      }
    } while (index >= 0);
    if (found) {
      this.logMsg(`delEventFilterCallback found at least one match!`);
    } else {
      this.logMsg(`delEventFilterCallback did NOT match any subcription callbacks!`);
    }
    return found;
  }

  public status(): EventStatus {
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
}

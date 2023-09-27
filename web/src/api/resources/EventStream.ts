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
  OnAgentLogCallback,
  OnErrorsSseCallback,
  OnErrorsOpenCallback,
  OnErrorsUnknownEventCallback,
  OnOpenSseCallback,
  OnPublishStartCallback,
  OnPublishCreateBundleStartCallback,
  OnPublishCreateBundleLogCallback,
  OnPublishCreateBundleSuccessCallback,
  OnPublishCreateBundleFailureCallback,
  OnPublishCreateDeploymentStartCallback,
  OnPublishCreateDeploymentSuccessCallback,
  OnPublishCreateDeploymentFailureCallback,
  OnPublishUploadBundleStartCallback,
  OnPublishUploadBundleSuccessCallback,
  OnPublishUploadBundleFailureCallback,
  OnPublishDeployBundleStartCallback,
  OnPublishDeployBundleSuccessCallback,
  OnPublishDeployBundleFailureCallback,
  OnPublishRestorePythonEnvStartCallback,
  OnPublishRestorePythonEnvLogCallback,
  OnPublishRestorePythonEnvSuccessCallback,
  OnPublishRestorePythonEnvFailureCallback,
  OnPublishRunContentStartCallback,
  OnPublishRunContentLogCallback,
  OnPublishRunContentSuccessCallback,
  OnPublishRunContentFailureCallback,
  OnPublishSuccessCallback,
  OnPublishFailureCallback,
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
      const strMsg = JSON.stringify(msg);
      this.logMsg(`WARNING! No subscriber/handler found for msg: ${strMsg}`);
      this.dispatchMessage({
        type: 'errors/unknownEvent',
        time: new Date().toString(),
        data: {
          event: strMsg,
        },
      });
    }
  }

  private onRawOpenCallback() {
    this.logMsg(`received RawOpenCallback`);
    this.isOpen = true;
    this.dispatchMessage({
      time: new Date().toISOString(),
      type: 'open/sse',
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
    const obj = camelcaseKeys(rawObj, { deep: true });
    if (isEventStreamMessage(obj)) {
      return obj;
    }
    return null;
  }

  private convertMessage(msg: EventStreamMessage) : EventStreamMessage {
    // We convert failure messages to a more generic form
    if (msg.type.includes('/failure')) {
      // split by /failure
      const parts = msg.type.split('/failure');
      // temporary!!! will be changing backend.
      msg.type = `${parts[0]}/failure` as EventSubscriptionTarget;
      if (parts.length === 1) {
        // we didn't get a failure qualifier
        msg.error = 'unknown';
      } else {
        // we'll set the error to the trailing failure qualifier, without the /
        msg.error = parts[1].slice(1);
      }
    }
    return msg;
  }

  private onMessageRawCallback(msg: MessageEvent) {
    this.logMsg(`received MessageRawCallback (for real): ${msg.data}`);
    const parsed = this.parseMessageData(msg.data);
    if (!parsed) {
      const errorMsg = `Invalid EventStreamMessage received: ${msg.data}`;
      const now = new Date();
      this.dispatchMessage({
        type: 'errors/sse',
        time: now.toString(),
        data: { msg: `${errorMsg}` },
      });
      return;
    }
    this.logMsg(`Received event type = ${parsed.type}`);
    const finalMsg = this.convertMessage(parsed);
    this.logMsg(`Converted to event type = ${finalMsg.type}`);
    this.dispatchMessage(finalMsg);
  }

  // Do we create a subscribe method for each type
  // or do we have everyone's handler do a type check in order to get to the type they expect?
  // isTypeOf(x, type) : is type of
  // (Seems like this makes more sense, so we can keep everything a bit more general purpose until
  // someone needs the specific type)
  // function isFoo(arg: any): arg is Foo {
  //   return arg.foo !== undefined;
  // }

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

  public addEventMonitorCallbackOld(
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

  // Provide Typescript function overloading, so we can facilitate type specific callbacks allowing
  // code to correctly type the incoming event automatically, if they are only receiving a single type of
  // message. If they are receiving multiple, then they should use the array target signature and use type guards
  // within that code to narrow down the type of the actual event received.
  public addEventMonitorCallback(target: EventSubscriptionTarget[],
    cb: OnMessageEventSourceCallback): void;
  public addEventMonitorCallback(target: '*', cb: OnMessageEventSourceCallback): void;
  public addEventMonitorCallback(target: 'agent/log', cb: OnAgentLogCallback): void;
  public addEventMonitorCallback(target: 'errors/*', cb: OnPublishStartCallback): void;
  public addEventMonitorCallback(target: 'errors/sse', cb: OnErrorsSseCallback): void;
  public addEventMonitorCallback(target: 'errors/open', cb: OnErrorsOpenCallback): void;
  public addEventMonitorCallback(target: 'errors/unknownEvent', cb: OnErrorsUnknownEventCallback): void;
  public addEventMonitorCallback(target: 'open/*', cb: OnMessageEventSourceCallback): void;
  public addEventMonitorCallback(target: 'open/sse', cb: OnOpenSseCallback): void;
  public addEventMonitorCallback(target: 'publish/*', cb: OnMessageEventSourceCallback): void;
  public addEventMonitorCallback(target: 'publish/**/log', cb: OnMessageEventSourceCallback): void;
  public addEventMonitorCallback(target: 'publish/**/failure', cb: OnMessageEventSourceCallback): void;
  public addEventMonitorCallback(target: 'publish/createBundle/start', cb: OnPublishCreateBundleStartCallback): void;
  public addEventMonitorCallback(target: 'publish/createBundle/log', cb: OnPublishCreateBundleLogCallback): void;
  public addEventMonitorCallback(target: 'publish/createBundle/success', cb: OnPublishCreateBundleSuccessCallback): void;
  public addEventMonitorCallback(target: 'publish/createBundle/failure', cb: OnPublishCreateBundleFailureCallback): void;
  public addEventMonitorCallback(target: 'publish/createDeployment/start', cb: OnPublishCreateDeploymentStartCallback): void;
  public addEventMonitorCallback(target: 'publish/createDeployment/success', cb: OnPublishCreateDeploymentSuccessCallback): void;
  public addEventMonitorCallback(target: 'publish/createDeployment/failure', cb: OnPublishCreateDeploymentFailureCallback): void;
  public addEventMonitorCallback(target: 'publish/uploadBundle/start', cb: OnPublishUploadBundleStartCallback): void;
  public addEventMonitorCallback(target: 'publish/uploadBundle/success', cb: OnPublishUploadBundleSuccessCallback): void;
  public addEventMonitorCallback(target: 'publish/uploadBundle/failure', cb: OnPublishUploadBundleFailureCallback): void;
  public addEventMonitorCallback(target: 'publish/deployBundle/start', cb: OnPublishDeployBundleStartCallback): void;
  public addEventMonitorCallback(target: 'publish/deployBundle/success', cb: OnPublishDeployBundleSuccessCallback): void;
  public addEventMonitorCallback(target: 'publish/deployBundle/failure', cb: OnPublishDeployBundleFailureCallback): void;
  public addEventMonitorCallback(target: 'publish/restorePythonEnv/start', cb: OnPublishRestorePythonEnvStartCallback): void;
  public addEventMonitorCallback(target: 'publish/restorePythonEnv/log', cb: OnPublishRestorePythonEnvLogCallback): void;
  public addEventMonitorCallback(target: 'publish/restorePythonEnv/success', cb: OnPublishRestorePythonEnvSuccessCallback): void;
  public addEventMonitorCallback(target: 'publish/restorePythonEnv/failure', cb: OnPublishRestorePythonEnvFailureCallback): void;
  public addEventMonitorCallback(target: 'publish/runContent/start', cb: OnPublishRunContentStartCallback): void;
  public addEventMonitorCallback(target: 'publish/runContent/log', cb: OnPublishRunContentLogCallback): void;
  public addEventMonitorCallback(target: 'publish/runContent/success', cb: OnPublishRunContentSuccessCallback): void;
  public addEventMonitorCallback(target: 'publish/runContent/failure', cb: OnPublishRunContentFailureCallback): void;
  public addEventMonitorCallback(target: 'publish/success', cb: OnPublishSuccessCallback): void;
  public addEventMonitorCallback(target: 'publish/failure', cb: OnPublishFailureCallback): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public addEventMonitorCallback(target: any, cb: any): void {
    if (Array.isArray(target)) {
      target.forEach(t => this.addEventMonitorCallback(t, cb));
    } else {
      this.subscriptions.push({
        eventType: target,
        callback: cb,
      });
    }
  }

  // Provide Typescript function overloading of each type of callback, corresponding to the 'addEventMonitorCallback'
  // overloading above.
  public delEventFilterCallback(cb: OnMessageEventSourceCallback): boolean;
  public delEventFilterCallback(cb: OnMessageEventSourceCallback): boolean;
  public delEventFilterCallback(cb: OnAgentLogCallback): boolean;
  public delEventFilterCallback(cb: OnPublishStartCallback): boolean;
  public delEventFilterCallback(cb: OnErrorsSseCallback): boolean;
  public delEventFilterCallback(cb: OnErrorsOpenCallback): boolean;
  public delEventFilterCallback(cb: OnErrorsUnknownEventCallback): boolean;
  public delEventFilterCallback(cb: OnMessageEventSourceCallback): boolean;
  public delEventFilterCallback(cb: OnOpenSseCallback): boolean;
  public delEventFilterCallback(cb: OnMessageEventSourceCallback): boolean;
  public delEventFilterCallback(cb: OnMessageEventSourceCallback): boolean;
  public delEventFilterCallback(cb: OnMessageEventSourceCallback): boolean;
  public delEventFilterCallback(cb: OnPublishCreateBundleStartCallback): boolean;
  public delEventFilterCallback(cb: OnPublishCreateBundleLogCallback): boolean;
  public delEventFilterCallback(cb: OnPublishCreateBundleSuccessCallback): boolean;
  public delEventFilterCallback(cb: OnPublishCreateBundleFailureCallback): boolean;
  public delEventFilterCallback(cb: OnPublishCreateDeploymentStartCallback): boolean;
  public delEventFilterCallback(cb: OnPublishCreateDeploymentSuccessCallback): boolean;
  public delEventFilterCallback(cb: OnPublishCreateDeploymentFailureCallback): boolean;
  public delEventFilterCallback(cb: OnPublishUploadBundleStartCallback): boolean;
  public delEventFilterCallback(cb: OnPublishUploadBundleSuccessCallback): boolean;
  public delEventFilterCallback(cb: OnPublishUploadBundleFailureCallback): boolean;
  public delEventFilterCallback(cb: OnPublishDeployBundleStartCallback): boolean;
  public delEventFilterCallback(cb: OnPublishDeployBundleSuccessCallback): boolean;
  public delEventFilterCallback(cb: OnPublishDeployBundleFailureCallback): boolean;
  public delEventFilterCallback(cb: OnPublishRestorePythonEnvStartCallback): boolean;
  public delEventFilterCallback(cb: OnPublishRestorePythonEnvLogCallback): boolean;
  public delEventFilterCallback(cb: OnPublishRestorePythonEnvSuccessCallback): boolean;
  public delEventFilterCallback(cb: OnPublishRestorePythonEnvFailureCallback): boolean;
  public delEventFilterCallback(cb: OnPublishRunContentStartCallback): boolean;
  public delEventFilterCallback(cb: OnPublishRunContentLogCallback): boolean;
  public delEventFilterCallback(cb: OnPublishRunContentSuccessCallback): boolean;
  public delEventFilterCallback(cb: OnPublishRunContentFailureCallback): boolean;
  public delEventFilterCallback(cb: OnPublishSuccessCallback): boolean;
  public delEventFilterCallback(cb: OnPublishFailureCallback): boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public delEventFilterCallback(cb: any): boolean {
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

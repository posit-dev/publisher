// Copyright (C) 2025 by Posit Software, PBC.

import { Disposable, env } from "vscode";

import { EventEmitter } from "events";

import { Events, EventStreamMessage, ProductType } from "src/api";
import { getProductName } from "src/utils/multiStepHelpers";
import { msgAddConnectCloudUrlParams } from "./utils/connectCloudHelpers";

export type EventStreamRegistration = (message: EventStreamMessage) => void;

export type UnregisterCallback = { unregister: () => void };

export function displayEventStreamMessage(msg: EventStreamMessage): string {
  msg = msgAddConnectCloudUrlParams(msg, env.appName);

  if (msg.type === "publish/checkCapabilities/log") {
    if (msg.data.username) {
      return `${msg.data.message}: username ${msg.data.username}, email ${msg.data.email}`;
    }
  }

  if (msg.type === "publish/createNewDeployment/success") {
    return `Created new Deployment as ${msg.data.saveName}`;
  }

  if (msg.type === "publish/createBundle/success") {
    return `Prepared file archive: ${msg.data.filename}`;
  }

  if (msg.type === "publish/createDeployment/start") {
    return `Updating existing Deployment with ID ${msg.data.contentId}`;
  }

  if (msg.type === "publish/createBundle/log") {
    if (msg.data.sourceDir) {
      return `${msg.data.message} ${msg.data.sourceDir}`;
    }

    if (msg.data.totalBytes) {
      return `${msg.data.message} ${msg.data.files} files, ${msg.data.totalBytes} bytes`;
    }

    if (msg.data.path) {
      return `${msg.data.message} ${msg.data.path} (${msg.data.size} bytes)`;
    }
  }

  if (
    msg.type === "publish/restorePythonEnv/log" ||
    msg.type === "publish/restoreREnv/log"
  ) {
    return `${msg.data.message}`;
  }

  if (msg.type === "publish/setVanityURL/log") {
    return `${msg.data.message} ${msg.data.path}`;
  }

  if (msg.type === "publish/validateDeployment/log") {
    if (msg.data.url) {
      if (msg.data.method) {
        return `${msg.data.message}: status ${msg.data.status} on ${msg.data.url}`;
      }
      return `${msg.data.message} ${msg.data.url}`;
    }
  }

  if (msg.type === "publish/validateDeployment/failure") {
    return `${msg.data.message}: status ${msg.data.status} on ${msg.data.logsUrl}`;
  }

  if (msg.type === "publish/success") {
    return `Successfully deployed at ${msg.data.dashboardUrl}`;
  }

  if (msg.type === "publish/failure") {
    const productType = msg.data.productType as ProductType;
    const productName = getProductName(productType);
    const url = msg.data.logsUrl || msg.data.dashboardUrl;

    if (url) {
      return `Deployment failed, click to view ${productName} logs: ${url}`;
    }
    if (msg.data.canceled === "true") {
      return "Deployment dismissed";
    }
    return "Deployment failed";
  }
  if (msg.error !== undefined) {
    return `${msg.data.error}`;
  }

  return msg.data.message || msg.type;
}

/**
 * Represents a stream of events.
 */
export class EventStream extends EventEmitter implements Disposable {
  // Array to store event messages
  private messages: EventStreamMessage[] = [];
  // Map to store event callbacks
  private callbacks: Map<string, EventStreamRegistration[]> = new Map();

  dispose() {}

  /**
   * Registers a callback function for a specific event type.
   * @param type The event type to register the callback for.
   * @param callback The callback function to be invoked when the event occurs.
   * @returns An object with an `unregister` method that can be used to remove the callback.
   */
  public register(
    type: string,
    callback: EventStreamRegistration,
  ): UnregisterCallback {
    if (!this.callbacks.has(type)) {
      this.callbacks.set(type, []);
    }
    // Add the callback to the callbacks array for the specified event type
    this.callbacks.get(type)?.push(callback);

    return {
      unregister: () => {
        // Remove the callback from the callbacks array for the specified event type
        this.callbacks.set(
          type,
          this.callbacks.get(type)?.filter((cb) => cb !== callback) || [],
        );
      },
    };
  }

  /**
   * Provide a way to inject a message and have it processed as if it
   * were received over the wire.
   * @param message The event message to pass along
   * @returns undefined
   */
  public injectMessage(message: Events) {
    this.processMessage(message);
  }

  private processMessage(msg: EventStreamMessage) {
    // Trace message
    // Uncomment the following code if you want to dump every message to the
    // console as it is received.
    // console.debug(`eventSource trace: ${msg.type}: ${JSON.stringify(msg)}`);

    // Add the message to the messages array
    this.messages.push(msg);
    // Emit a 'message' event with the message as the payload
    this.emit("message", msg);
    // Invoke the registered callbacks for the message type
    this.invokeCallbacks(msg);
  }

  private invokeCallbacks(message: EventStreamMessage) {
    const type = message.type;
    if (this.callbacks.has(type)) {
      // Invoke all the callbacks for the specified event type with the message as the argument
      this.callbacks.get(type)?.forEach((callback) => callback(message));
    }
  }
}

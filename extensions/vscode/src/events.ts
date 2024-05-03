// Copyright (C) 2024 by Posit Software, PBC.

/* eslint-disable @typescript-eslint/naming-convention */

import { Disposable } from "vscode";

import EventSource from "eventsource";
import { Readable } from "stream";
import { EventStreamMessage } from "./api";

export type EventStreamRegistration = (message: EventStreamMessage) => void;

export type UnregisterCallback = { unregister: () => void };

export function displayEventStreamMessage(msg: EventStreamMessage): string {
  if (msg.type === "publish/checkCapabilities/log") {
    if (msg.data.username) {
      return `${msg.data.message}: username ${msg.data.username}, email ${msg.data.email}`;
    }
  }

  if (msg.type === "publish/createNewDeployment/success") {
    return `Created new deployment as ${msg.data.saveName}`;
  }

  if (msg.type === "publish/createBundle/success") {
    return `Prepared file archive: ${msg.data.filename}`;
  }

  if (msg.type === "publish/createDeployment/start") {
    return `Updating existing deployment with ID ${msg.data.contentId}`;
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

  if (msg.type === "publish/restorePythonEnv/log") {
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
    return `${msg.data.message}: status ${msg.data.status} on ${msg.data.url}`;
  }

  if (msg.type === "publish/success") {
    return `Successfully deployed at ${msg.data.dashboardUrl}`;
  }

  if (msg.type === "publish/failure") {
    if (msg.data.dashboardUrl) {
      return `Deployment failed: ${msg.data.dashboardUrl}`;
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
 * Extends the Readable stream class.
 */
export class EventStream extends Readable implements Disposable {
  private eventSource: EventSource;
  // Array to store event messages
  private messages: EventStreamMessage[] = [];
  // Map to store event callbacks
  private callbacks: Map<string, EventStreamRegistration[]> = new Map();

  /**
   * Creates a new instance of the EventStream class.
   * @param port The port number to connect to.
   */
  constructor(port: number) {
    super();
    // Create a new EventSource instance to connect to the event stream
    this.eventSource = new EventSource(
      `http://127.0.0.1:${port}/api/events?stream=messages`,
    );
    // Listen for 'message' events from the EventSource
    this.eventSource.addEventListener("message", (event) => {
      // Parse the event data and convert keys to camel case
      const message = convertKeysToCamelCase(JSON.parse(event.data));

      // Trace message
      console.debug(
        `eventSource trace: ${event.type}: ${JSON.stringify(event)}`,
      );

      // Add the message to the messages array
      this.messages.push(message);
      // Emit a 'message' event with the message as the payload
      this.emit("message", message);
      // Invoke the registered callbacks for the message type
      this.invokeCallbacks(message);
    });
  }

  dispose() {
    // Destroy this Reader so it cannot be used after disposed
    this.destroy();
    this.eventSource.close();
  }

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

  private invokeCallbacks(message: EventStreamMessage) {
    const type = message.type;
    if (this.callbacks.has(type)) {
      // Invoke all the callbacks for the specified event type with the message as the argument
      this.callbacks.get(type)?.forEach((callback) => callback(message));
    }
  }
}

/**
 * Converts the keys of an object to camel case recursively.
 * @param object - The object to convert.
 * @returns The object with camel case keys.
 */
const convertKeysToCamelCase = (object: any): any => {
  if (typeof object !== "object" || object === null) {
    return object;
  }

  if (Array.isArray(object)) {
    // Recursively convert keys for each item in the array
    return object.map((item) => convertKeysToCamelCase(item));
  }

  const newObject: any = {};
  for (const key in object) {
    if (object.hasOwnProperty(key)) {
      // Convert the key to camel case
      const newKey = key.charAt(0).toLowerCase() + key.slice(1);
      // Recursively convert keys for nested objects
      newObject[newKey] = convertKeysToCamelCase(object[key]);
    }
  }
  return newObject;
};

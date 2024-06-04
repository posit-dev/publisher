// Copyright (C) 2024 by Posit Software, PBC.

/* eslint-disable @typescript-eslint/naming-convention */

import { Disposable } from "vscode";

import EventSource from "eventsource";
import { Readable } from "stream";

import { EventStreamMessage } from "src/api";

export type EventStreamRegistration = (message: EventStreamMessage) => void;

export type UnregisterCallback = { unregister: () => void };

export function displayEventStreamMessage(msg: EventStreamMessage): string {
  if (msg.type === "publish/checkCapabilities/log") {
    if (msg.data.username) {
      return `${msg.data.message}: username ${msg.data.username}, email ${msg.data.email}`;
    }
  }

  if (msg.type === "publish/createNewContentRecord/success") {
    return `Created new contentRecord as ${msg.data.saveName}`;
  }

  if (msg.type === "publish/createBundle/success") {
    return `Prepared file archive: ${msg.data.filename}`;
  }

  if (msg.type === "publish/createContentRecord/start") {
    return `Updating existing contentRecord with ID ${msg.data.contentId}`;
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

  if (msg.type === "publish/validateContentRecord/log") {
    if (msg.data.url) {
      if (msg.data.method) {
        return `${msg.data.message}: status ${msg.data.status} on ${msg.data.url}`;
      }
      return `${msg.data.message} ${msg.data.url}`;
    }
  }

  if (msg.type === "publish/validateContentRecord/failure") {
    return `${msg.data.message}: status ${msg.data.status} on ${msg.data.url}`;
  }

  if (msg.type === "publish/success") {
    return `Successfully deployed at ${msg.data.dashboardUrl}`;
  }

  if (msg.type === "publish/failure") {
    if (msg.data.dashboardUrl) {
      return `ContentRecord failed, click to view Connect logs: ${msg.data.dashboardUrl}`;
    }
    return "ContentRecord failed";
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

      // Invoke the message factory
      this.messageFactory(message).forEach((msg) => {
        // Trace message
        console.debug(
          `eventSource trace: ${event.type}: ${JSON.stringify(event)}`,
        );
        // Add the message to the messages array
        this.messages.push(msg);
        // Emit a 'message' event with the message as the payload
        this.emit("message", msg);
        // Invoke the registered callbacks for the message type
        this.invokeCallbacks(msg);
      });
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

  private messageFactory(message: EventStreamMessage): EventStreamMessage[] {
    // Transform restoreREnv messages into restoreEnv messages
    // while maintaining original message
    if (message.type.includes("publish/restoreREnv")) {
      const messages: EventStreamMessage[] = [];
      messages.push(message);
      const newMessage: EventStreamMessage = JSON.parse(
        JSON.stringify(message),
      );

      switch (message.type) {
        case "publish/restoreREnv/start":
          newMessage.type = "publish/restoreEnv/start";
          break;
        case "publish/restoreREnv/success":
          newMessage.type = "publish/restoreEnv/success";
          break;
        case "publish/restoreREnv/failure":
          newMessage.type = "publish/restoreEnv/failure";
          break;
        case "publish/restoreREnv/status":
          newMessage.type = "publish/restoreEnv/status";
          break;
        case "publish/restoreREnv/log":
          newMessage.type = "publish/restoreEnv/log";
          break;
        case "publish/restoreREnv/progress":
          newMessage.type = "publish/restoreEnv/progress";
          break;
        default:
          throw new Error(
            `events::messageFactory: Unknown publish/restoreREnv based message: ${newMessage.type}`,
          );
      }
      messages.push(newMessage);
      return messages;
    }
    // Transform restorePythonEnv messages into restoreEnv messages
    // while maintaining original message
    if (message.type.includes("publish/restorePythonEnv")) {
      const messages: EventStreamMessage[] = [];
      messages.push(message);
      const newMessage: EventStreamMessage = JSON.parse(
        JSON.stringify(message),
      );
      switch (message.type) {
        case "publish/restorePythonEnv/start":
          newMessage.type = "publish/restoreEnv/start";
          break;
        case "publish/restorePythonEnv/success":
          newMessage.type = "publish/restoreEnv/success";
          break;
        case "publish/restorePythonEnv/failure":
          newMessage.type = "publish/restoreEnv/failure";
          break;
        case "publish/restorePythonEnv/status":
          newMessage.type = "publish/restoreEnv/status";
          break;
        case "publish/restorePythonEnv/log":
          newMessage.type = "publish/restoreEnv/log";
          break;
        case "publish/restorePythonEnv/progress":
          newMessage.type = "publish/restoreEnv/progress";
          break;
        default:
          throw new Error(
            `events::messageFactory: Unknown publish/restorePythonEnv based message: ${newMessage.type}`,
          );
      }
      messages.push(newMessage);
      return messages;
    }

    // no transformation
    return [message];
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

// Copyright (C) 2024 by Posit Software, PBC.

/* eslint-disable @typescript-eslint/naming-convention */

import * as EventSource from 'eventsource';
import { Readable } from 'stream';

export type EventStreamMessage = {
  type: string;
  data: Record<string, string>;
};

export type EventStreamMessageCallback = (message: EventStreamMessage) => void;

/**
 * Represents a stream of events.
 * Extends the Readable stream class.
 */
export class EventStream extends Readable {
  // Array to store event messages
  private messages: EventStreamMessage[] = [];
  // Map to store event callbacks
  private callbacks: Map<string, EventStreamMessageCallback[]> = new Map();

  /**
   * Creates a new instance of the EventStream class.
   * @param port The port number to connect to.
   */
  constructor(port: number) {
    super();
    // Create a new EventSource instance to connect to the event stream
    const eventSource = new EventSource(`http://127.0.0.1:${port}/api/events?stream=messages`);
    // Listen for 'message' events from the EventSource
    eventSource.addEventListener('message', (event) => {
      // Parse the event data and convert keys to camel case
      const message = convertKeysToCamelCase(JSON.parse(event.data));
      // Add the message to the messages array
      this.messages.push(message);
      // Emit a 'message' event with the message as the payload
      this.emit('message', message);
      // Invoke the registered callbacks for the message type
      this.invokeCallbacks(message);
    });
  }

  /**
   * Registers a callback function for a specific event type.
   * @param type The event type to register the callback for.
   * @param callback The callback function to be invoked when the event occurs.
   */
  public register(type: string, callback: EventStreamMessageCallback) {
    if (!this.callbacks.has(type)) {
      this.callbacks.set(type, []);
    }
    // Add the callback to the callbacks array for the specified event type
    this.callbacks.get(type)?.push(callback);
  }

  private invokeCallbacks(message: EventStreamMessage) {
    const type = message.type;
    if (this.callbacks.has(type)) {
      // Invoke all the callbacks for the specified event type with the message as the argument
      this.callbacks.get(type)?.forEach(callback => callback(message));
    }
  }
}

/**
 * Converts the keys of an object to camel case recursively.
 * @param object - The object to convert.
 * @returns The object with camel case keys.
 */
const convertKeysToCamelCase = (object: any): any => {
  if (typeof object !== 'object' || object === null) {
    return object;
  }

  if (Array.isArray(object)) {
    // Recursively convert keys for each item in the array
    return object.map(item => convertKeysToCamelCase(item));
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

/* eslint-disable @typescript-eslint/naming-convention */
import * as EventSource from 'eventsource';

import { Readable } from 'stream';

export type EventStreamMessage = {
  'type': string;
};

export type EventStreamMessageCallback = (message: EventStreamMessage) => void;

export class EventStream extends Readable {
  private messages: EventStreamMessage[] = [];
  private callbacks: { [type: string]: EventStreamMessageCallback[] } = {};

  constructor(port: number) {
    super();
    const eventSource = new EventSource(`http://127.0.0.1:${port}/api/events?stream=messages`);
    eventSource.addEventListener('message', (event) => {
      const message = convertKeysToCamelCase(JSON.parse(event.data));
      this.messages.push(message);
      this.emit('message', message);
      this.invokeCallbacks(message);
    });
  }

  public register(type: string, callback: EventStreamMessageCallback) {
    if (!this.callbacks[type]) {
      this.callbacks[type] = [];
    }
    this.callbacks[type].push(callback);
  }

  private invokeCallbacks(message: EventStreamMessage) {
    const type = message.type;
    if (this.callbacks[type]) {
      this.callbacks[type].forEach(callback => callback(message));
    }
  }
}


const convertKeysToCamelCase = (object: any): any => {
  if (typeof object !== 'object' || object === null) {
    return object;
  }

  if (Array.isArray(object)) {
    return object.map(item => convertKeysToCamelCase(item));
  }

  const newObject: any = {};
  for (const key in object) {
    if (object.hasOwnProperty(key)) {
      const newKey = key.charAt(0).toLowerCase() + key.slice(1);
      newObject[newKey] = convertKeysToCamelCase(object[key]);
    }
  }
  return newObject;
};

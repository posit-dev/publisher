// Copyright (C) 2023 by Posit Software, PBC.

import { defineStore } from 'pinia';
import { EventStream } from 'src/api/resources/EventStream';
import { MockMessage } from 'src/api/types/events';
import { ref } from 'vue';

// export const useEventStoreOld = defineStore('events', {
//   state: () : EventState => {
//     const eventStream = new EventStream();
//     return {
//       eventStream,
//       errorEvents: <MessageEvent[]>[],
//       dataEvents: <MessageEvent[]>[],
//     };
//   },
// });

export const useEventStore = defineStore('events', () => {
  const eventStream = new EventStream();

  const openEvents = ref(<MessageEvent[]>[]);
  const errorEvents = ref(<Event[]>[]);

  // Not implementing the data list as a ref, as consumption of this
  // unknown length arrays should be consumed by virtual displays
  // rather than just reactive data. So the count of these will
  // be reactive, but accessing value will be via direct array
  // indexes when someone knows they are needed.
  const dataEvents = <MessageEvent[]>[];
  const numDataEvents = ref(0);

  // initialize handling event callbacks
  function incomingOpenEvent() {
    const e = new MessageEvent('opened');
    openEvents.value.push(e);
  }
  eventStream.addOpenEventCallback(incomingOpenEvent);

  function incomingErrorEvent(e: Event) {
    errorEvents.value.push(e);
  }
  eventStream.addErrorEventCallback(incomingErrorEvent);

  function incomingDataMessage(msg: MessageEvent) {
    dataEvents.push(msg);
    numDataEvents.value = dataEvents.length;
    return true;
  }
  eventStream.addMessageEventCallback(incomingDataMessage);

  function initConnection(url: string, withCredentials = false) {
    return eventStream.open(url, withCredentials);
  }

  function closeConnection() {
    return eventStream.close();
  }

  function getConnectionStatus() {
    return eventStream.status();
  }

  function enableConnectionDebugMode() {
    return eventStream.setDebugMode(true);
  }

  function pushMockMessageIntoConnection(msg: MockMessage) {
    return eventStream.pushMockMessage(msg);
  }

  return {
    initConnection,
    closeConnection,
    getConnectionStatus,
    enableConnectionDebugMode,
    pushMockMessageIntoConnection,
    errorEvents,
    dataEvents,
    numDataEvents,
    openEvents,
  };
});

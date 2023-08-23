// Copyright (C) 2023 by Posit Software, PBC.

import { defineStore } from 'pinia';
import { EventStream } from 'src/api/resources/EventStream';
import { EventStreamMessage, MockMessage } from 'src/api/types/events';
import { ref } from 'vue';

export const useEventStore = defineStore('events', () => {
  const eventStream = new EventStream();

  const openEvents = ref(<EventStreamMessage[]>[]);
  const errorEvents = ref(<EventStreamMessage[]>[]);
  const dataEvents = ref(<EventStreamMessage[]>[]);
  const logEvents = ref(<EventStreamMessage[]>[]);
  const unknownEvents = ref(<EventStreamMessage[]>[]);

  // initialize handling event callbacks
  function incomingOpenEvent(msg: EventStreamMessage) {
    openEvents.value.push(msg);
  }
  eventStream.addEventMonitorCallback('open/*', incomingOpenEvent);

  function incomingErrorEvent(msg: EventStreamMessage) {
    errorEvents.value.push(msg);
  }
  eventStream.addEventMonitorCallback('errors/*', incomingErrorEvent);

  function incomingDataMessage(msg: EventStreamMessage) {
    dataEvents.value.push(msg);
  }
  eventStream.addEventMonitorCallback('*', incomingDataMessage);

  function incomingLogMessage(msg: EventStreamMessage) {
    logEvents.value.push(msg);
  }
  // subscribe to all logs
  eventStream.addEventMonitorCallback('publishing/**/log', incomingLogMessage);

  function unknownMessage(msg: EventStreamMessage) {
    unknownEvents.value.push(msg);
  }
  eventStream.addEventMonitorCallback('errors/unknownEvent', unknownMessage);

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
    openEvents,
    logEvents,
    unknownEvents,
  };
});

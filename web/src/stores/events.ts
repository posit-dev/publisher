// Copyright (C) 2023 by Posit Software, PBC.

import { defineStore } from 'pinia';
import { EventStream } from 'src/api/resources/EventStream';
import { EventStreamMessage, MockMessage } from 'src/api/types/events';
import { ref } from 'vue';

export const useEventStore = defineStore('events', () => {
  const eventStream = new EventStream();

  const agentLog = ref(<EventStreamMessage[]>[]);
  const progressLog = ref(<EventStreamMessage[]>[]);
  const progressEvents = ref(<EventStreamMessage[]>[]);
  const errorEvents = ref(<EventStreamMessage[]>[]);
  const unknownEvents = ref(<EventStreamMessage[]>[]);

  function incomingErrorEvent(msg: EventStreamMessage) {
    // Error received when agent has been stopped:
    // { "type": "errors/open", "time": "Tue Sep 12 2023 11:51:55 GMT-0700 (Pacific Daylight Time)", "data": "{ msg: unknown error with connection 1694544715918 }" }
    errorEvents.value.push(msg);
  }
  eventStream.addEventMonitorCallback(['errors/*'], incomingErrorEvent);

  function incomingUnknownEvent(msg: EventStreamMessage) {
    // Error received when agent has been stopped:
    // { "type": "errors/open", "time": "Tue Sep 12 2023 11:51:55 GMT-0700 (Pacific Daylight Time)", "data": "{ msg: unknown error with connection 1694544715918 }" }
    errorEvents.value.push(msg);
  }
  eventStream.addEventMonitorCallback(['errors/unknownEvent'], incomingUnknownEvent);

  function incomingAgentLogEvent(msg: EventStreamMessage) {
    agentLog.value.push(msg);
  }
  eventStream.addEventMonitorCallback(['agent/log'], incomingAgentLogEvent);

  function incomingProgressLogEvent(msg: EventStreamMessage) {
    progressLog.value.push(msg);
  }
  eventStream.addEventMonitorCallback(['publish/**/log'], incomingProgressLogEvent);

  function incomingProgressEvent(msg: EventStreamMessage) {
    progressEvents.value.push(msg);
  }
  eventStream.addEventMonitorCallback([
    'publish/createBundle/start',
    'publish/createBundle/success',
    'publish/createDeployment/start',
    'publish/createDeployment/success',
    'publish/uploadBundle/start',
    'publish/uploadBundle/success',
    'publish/deployBundle/start',
    'publish/deployBundle/success',
    'publish/restorePythonEnv/log',
    'publish/restorePythonEnv/success',
    'publish/runContent/log',
    'publish/runContent/success',
  ], incomingProgressEvent);

  function clearStore() {
    agentLog.value = [];
    progressLog.value = [];
    progressEvents.value = [];
    errorEvents.value = [];
    unknownEvents.value = [];
  }

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
    clearStore,
    agentLog,
    progressLog,
    progressEvents,
    errorEvents,
    unknownEvents,
  };
});

// Copyright (C) 2023 by Posit Software, PBC.

import { defineStore } from 'pinia';
import { useApi } from 'src/api';

import {
  EventStreamMessage,
  PublishStart,
  PublishSuccess,
  PublishFailure,
  getLocalId,
} from 'src/api/types/events';

import {
  useEventStream,
} from 'src/plugins/eventStream';
import { getErrorMessage } from 'src/util/errors';

import { ref } from 'vue';

export type PublishStatus = {
  completed: boolean;
  error?: string;
}

export const useEventStore = defineStore('event', () => {
  const eventStream = useEventStream();

  const api = useApi();

  const publishInProgess = ref(false);
  const latestLocalId = ref('');

  const publishStatusMap = ref(new Map<string, PublishStatus>());

  const closeEventStream = () => {
    eventStream.close();
  };

  const incomingEvent = (msg: EventStreamMessage) => {
    console.log(msg.data);
  };

  const onPublishStart = (msg: PublishStart) => {
    console.log('received start');
    publishInProgess.value = true;
    const localId = getLocalId(msg);
    publishStatusMap.value.set(localId, {
      completed: false,
    });
    latestLocalId.value = localId;
  };

  const onPublishSuccess = (msg: PublishSuccess) => {
    const localId = getLocalId(msg);
    console.log(`received success: ${localId}`);
    publishStatusMap.value.set(localId, {
      completed: true,
    });
    publishInProgess.value = false;
  };

  const onPublishFailure = (msg: PublishFailure) => {
    console.log('received failure');
    publishStatusMap.value.set(getLocalId(msg), {
      completed: true,
      error: msg.error,
    });
    publishInProgess.value = false;
  };

  const initiatePublishProcessWithEvents = async(
    accountName : string,
    contentId?: string,
  ) : Promise<string | Error> => {
    if (publishInProgess.value) {
      return new Error('Publishing already in progress');
    }

    try {
      publishInProgess.value = true;
      const response = await api.deployments.publish(
        accountName,
        contentId,
      );
      const localId = <string>response.data.localId;
      return localId;
    } catch (error) {
      return new Error(getErrorMessage(error));
    }
  };

  const init = () => {
    eventStream.addEventMonitorCallback('*', incomingEvent);
    eventStream.addEventMonitorCallback('publish/start', onPublishStart);
    eventStream.addEventMonitorCallback('publish/success', onPublishSuccess);
    eventStream.addEventMonitorCallback('publish/failure', onPublishFailure);

    eventStream.setDebugMode(false);
    eventStream.open('api/events?stream=messages');
    console.log(eventStream.status());
  };
  init();

  return {
    closeEventStream,
    publishStatusMap,
    publishInProgess,
    initiatePublishProcessWithEvents,
    latestLocalId,
  };
});

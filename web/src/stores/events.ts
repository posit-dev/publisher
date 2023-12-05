// Copyright (C) 2023 by Posit Software, PBC.

import { defineStore } from 'pinia';
import { useApi } from 'src/api';

import {
  EventStreamMessage,
  PublishStart,
  PublishSuccess,
  PublishFailure,
  getLocalId,
  PublishCreateNewDeploymentStart,
  PublishCreateNewDeploymentSuccess,
  PublishCreateNewDeploymentFailure,
  PublishSetEnvVarsStart,
  PublishSetEnvVarsSuccess,
  PublishSetEnvVarsFailure,
  PublishCreateBundleStart,
  PublishCreateBundleLog,
  PublishCreateBundleSuccess,
  PublishCreateBundleFailure,
  PublishCreateDeploymentStart,
  PublishCreateDeploymentSuccess,
  PublishCreateDeploymentFailure,
  PublishUploadBundleStart,
  PublishUploadBundleSuccess,
  PublishUploadBundleFailure,
  PublishDeployBundleStart,
  PublishDeployBundleSuccess,
  PublishDeployBundleFailure,
  PublishRestorePythonEnvStart,
  PublishRestorePythonEnvLog,
  PublishRestorePythonEnvProgress,
  PublishRestorePythonEnvStatus,
  PublishRestorePythonEnvSuccess,
  PublishRestorePythonEnvFailure,
  PublishRunContentStart,
  PublishRunContentLog,
  PublishRunContentSuccess,
  PublishRunContentFailure,
  PublishSetVanityURLStart,
  PublishSetVanityURLLog,
  PublishSetVanityURLSuccess,
  PublishSetVanityURLFailure,
  PublishValidateDeploymentStart,
  PublishValidateDeploymentLog,
  PublishValidateDeploymentSuccess,
  PublishValidateDeploymentFailure,
  AgentLog,
} from 'src/api/types/events';

import {
  useEventStream,
} from 'src/plugins/eventStream';
import { getErrorMessage } from 'src/util/errors';

import { ref } from 'vue';

export type PublishStepCompletionStatus =
  'unknown' | 'started' | 'success' | 'error';

export type PublishStep =
  'createNewDeployment' | 'setEnvVars' | 'createBundle' |
  'createDeployment' | 'uploadBundle' | 'deployBundle' |
  'restorePythonEnv' | 'setVanityURL' | 'runContent' |
  'validateDeployment';

export type PublishStepStatus = {
  completion: PublishStepCompletionStatus;
  error?: string;
  lastLogMsg?: string;
  logs: EventStreamMessage[];
  status?: string[];
  progress?: string[];
}

const emptyPublishStepStatus = {
  completion: <PublishStepCompletionStatus>'unknown',
  logs: <EventStreamMessage[]>[],
};

export type PublishStatus = {
  completion: PublishStepCompletionStatus;
  error?: string;
  steps: {
    createNewDeployment: PublishStepStatus,
    setEnvVars: PublishStepStatus,
    createBundle: PublishStepStatus,
    createDeployment: PublishStepStatus,
    uploadBundle: PublishStepStatus,
    deployBundle: PublishStepStatus,
    restorePythonEnv: PublishStepStatus,
    setVanityURL: PublishStepStatus,
    runContent: PublishStepStatus,
    validateDeployment: PublishStepStatus,
  }
}

const newPublishStatus = () => {
  return {
    completion: <PublishStepCompletionStatus>'unknown',
    error: undefined,
    steps: {
      createNewDeployment: { ...emptyPublishStepStatus },
      setEnvVars: { ...emptyPublishStepStatus },
      createBundle: { ...emptyPublishStepStatus },
      createDeployment: { ...emptyPublishStepStatus },
      uploadBundle: { ...emptyPublishStepStatus },
      deployBundle: { ...emptyPublishStepStatus },
      restorePythonEnv: { ...emptyPublishStepStatus },
      setVanityURL: { ...emptyPublishStepStatus },
      runContent: { ...emptyPublishStepStatus },
      validateDeployment: { ...emptyPublishStepStatus },
    },
  };
};

export const useEventStore = defineStore('event', () => {
  const eventStream = useEventStream();

  const api = useApi();

  const publishInProgess = ref(false);
  const latestLocalId = ref('');

  // Map of localId -> publish status
  // and when available (since they don't overlap), contentId -> publish status 
  const publishStatusMap = ref(new Map<string, PublishStatus>());

  const closeEventStream = () => {
    eventStream.close();
  };

  const incomingEvent = (msg: EventStreamMessage) => {
    console.log(msg.type, msg.data);
  };

  const onAgentLog = (msg: AgentLog) => {
    console.log(`Agent Log: ${msg.data.message}`);
  };

  const onPublishStart = (msg: PublishStart) => {
    const localId = getLocalId(msg);
    console.log('onPublishStart', JSON.stringify(msg));

    const publishStatus = newPublishStatus();
    publishStatus.completion = 'started';
    publishStatusMap.value.set(localId, publishStatus);
    latestLocalId.value = localId;
  };

  const onPublishSuccess = (msg: PublishSuccess) => {
    const localId = getLocalId(msg);
    console.log('onPublishSuccess', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.completion = 'success';
    }
    publishInProgess.value = false;
  };

  const onPublishFailure = (msg: PublishFailure) => {
    const localId = getLocalId(msg);
    console.log('onPublishFailure', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.completion = 'error';
      publishStatus.error = msg.error;
    }
    publishInProgess.value = false;
  };

  const onPublishCreateNewDeploymentStart = (msg: PublishCreateNewDeploymentStart) => {
    const localId = getLocalId(msg);
    console.log('onPublishCreateNewDeploymentStart', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.createNewDeployment.completion = 'started';
    }
  };

  const onPublishCreateNewDeploymentSuccess = (msg: PublishCreateNewDeploymentSuccess) => {
    const localId = getLocalId(msg);
    console.log('onPublishCreateNewDeploymentSuccess', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.createNewDeployment.completion = 'success';
    }
  };

  const onPublishCreateNewDeploymentFailure = (msg: PublishCreateNewDeploymentFailure) => {
    const localId = getLocalId(msg);
    console.log('onPublishCreateNewDeploymentFailure', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.createNewDeployment.completion = 'error';
      publishStatus.steps.createNewDeployment.error = msg.error;
    }
  };

  const onPublishSetEnvVarsStart = (msg: PublishSetEnvVarsStart) => {
    const localId = getLocalId(msg);
    console.log('onPublishSetEnvVarsStart', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.setEnvVars.completion = 'started';
    }
  };

  const onPublishSetEnvVarsSuccess = (msg: PublishSetEnvVarsSuccess) => {
    const localId = getLocalId(msg);
    console.log('onPublishSetEnvVarsSuccess', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.setEnvVars.completion = 'success';
    }
  };
  const onPublishSetEnvVarsFailure = (msg: PublishSetEnvVarsFailure) => {
    const localId = getLocalId(msg);
    console.log('onPublishSetEnvVarsFailure', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.setEnvVars.completion = 'error';
      publishStatus.steps.setEnvVars.error = msg.error;
    }
  };

  const onPublishCreateBundleStart = (msg: PublishCreateBundleStart) => {
    const localId = getLocalId(msg);
    console.log('onPublishCreateBundleStart', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.createBundle.completion = 'started';
    }
  };

  const onPublishCreateBundleLog = (msg: PublishCreateBundleLog) => {
    const localId = getLocalId(msg);
    console.log('onPublishCreateBundleLog', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.createBundle.logs.push(msg);
    }
  };

  const onPublishCreateBundleSuccess = (msg: PublishCreateBundleSuccess) => {
    const localId = getLocalId(msg);
    console.log('onPublishCreateBundleSuccess', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.createBundle.completion = 'success';
    }
  };

  const onPublishCreateBundleFailure = (msg: PublishCreateBundleFailure) => {
    const localId = getLocalId(msg);
    console.log('onPublishCreateBundleFailure', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.createBundle.completion = 'error';
      publishStatus.steps.createBundle.error = msg.error;
    }
  };

  const onPublishCreateDeploymentStart = (msg: PublishCreateDeploymentStart) => {
    const localId = getLocalId(msg);
    console.log('onPublishCreateDeploymentStart', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.createDeployment.completion = 'started';
    }
  };

  const onPublishCreateDeploymentSuccess = (msg: PublishCreateDeploymentSuccess) => {
    const localId = getLocalId(msg);
    console.log('onPublishCreateDeploymentSuccess', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.createDeployment.completion = 'success';
      publishStatusMap.value.set(msg.data.contentId, publishStatus);
    }
  };

  const onPublishCreateDeploymentFailure = (msg: PublishCreateDeploymentFailure) => {
    const localId = getLocalId(msg);
    console.log('onPublishCreateDeploymentFailure', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.createDeployment.completion = 'error';
      publishStatus.steps.createDeployment.error = msg.error;
    }
  };

  const onPublishUploadBundleStart = (msg: PublishUploadBundleStart) => {
    const localId = getLocalId(msg);
    console.log('onPublishUploadBundleStart', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.uploadBundle.completion = 'started';
    }
  };

  const onPublishUploadBundleSuccess = (msg: PublishUploadBundleSuccess) => {
    const localId = getLocalId(msg);
    console.log('onPublishUploadBundleSuccess', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.uploadBundle.completion = 'success';
    }
  };

  const onPublishUploadBundleFailure = (msg: PublishUploadBundleFailure) => {
    const localId = getLocalId(msg);
    console.log('onPublishUploadBundleFailure', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.uploadBundle.completion = 'error';
      publishStatus.steps.uploadBundle.error = msg.error;
    }
  };

  const onPublishDeployBundleStart = (msg: PublishDeployBundleStart) => {
    const localId = getLocalId(msg);
    console.log('onPublishDeployBundleStart', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.deployBundle.completion = 'started';
    }
  };

  const onPublishDeployBundleSuccess = (msg: PublishDeployBundleSuccess) => {
    const localId = getLocalId(msg);
    console.log('onPublishDeployBundleSuccess', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.deployBundle.completion = 'success';
    }
  };

  const onPublishDeployBundleFailure = (msg: PublishDeployBundleFailure) => {
    const localId = getLocalId(msg);
    console.log('onPublishDeployBundleFailure', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.uploadBundle.completion = 'error';
      publishStatus.steps.deployBundle.error = msg.error;
    }
  };

  const onPublishRestorePythonEnvStart = (msg: PublishRestorePythonEnvStart) => {
    const localId = getLocalId(msg);
    console.log('onPublishRestorePythonEnvStart', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.restorePythonEnv.completion = 'started';
    }
  };

  const onPublishRestorePythonEnvLog = (msg: PublishRestorePythonEnvLog) => {
    const localId = getLocalId(msg);
    console.log('onPublishRestorePythonEnvLog', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.restorePythonEnv.logs.push(msg);
    }
  };

  const onPublishRestorePythonEnvProgress = (msg: PublishRestorePythonEnvProgress) => {
    const localId = getLocalId(msg);
    console.log('onPublishRestorePythonEnvProgress', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      if (!publishStatus.steps.restorePythonEnv.progress) {
        publishStatus.steps.restorePythonEnv.progress = [];
      }
      publishStatus.steps.restorePythonEnv.progress.push(JSON.stringify(msg.data));
    }
  };

  const onPublishRestorePythonEnvStatus = (msg: PublishRestorePythonEnvStatus) => {
    const localId = getLocalId(msg);
    console.log('onPublishRestorePythonEnvStatus', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      if (!publishStatus.steps.restorePythonEnv.status) {
        publishStatus.steps.restorePythonEnv.status = [];
      }
      publishStatus.steps.restorePythonEnv.status.push(JSON.stringify(msg.data));
    }
  };

  const onPublishRestorePythonEnvSuccess = (msg: PublishRestorePythonEnvSuccess) => {
    const localId = getLocalId(msg);
    console.log('onPublishRestorePythonEnvSuccess', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.restorePythonEnv.completion = 'success';
    }
  };

  const onPublishRestorePythonEnvFailure = (msg: PublishRestorePythonEnvFailure) => {
    const localId = getLocalId(msg);
    console.log('onPublishRestorePythonEnvFailure', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.uploadBundle.completion = 'error';
      publishStatus.steps.restorePythonEnv.error = msg.error;
    }
  };

  const onPublishRunContentStart = (msg: PublishRunContentStart) => {
    const localId = getLocalId(msg);
    console.log('onPublishRunContentStart', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.runContent.completion = 'started';
    }
  };

  const onPublishRunContentLog = (msg: PublishRunContentLog) => {
    const localId = getLocalId(msg);
    console.log('onPublishRunContentLog', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.runContent.logs.push(msg);
    }
  };

  const onPublishRunContentSuccess = (msg: PublishRunContentSuccess) => {
    const localId = getLocalId(msg);
    console.log('onPublishRunContentSuccess', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.runContent.completion = 'success';
    }
  };

  const onPublishRunContentFailure = (msg: PublishRunContentFailure) => {
    const localId = getLocalId(msg);
    console.log('onPublishRunContentFailure', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.runContent.completion = 'error';
      publishStatus.steps.runContent.error = msg.error;
    }
  };

  const onPublishSetVanityURLStart = (msg: PublishSetVanityURLStart) => {
    const localId = getLocalId(msg);
    console.log('onPublishSetVanityURLStartlishStart', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.setVanityURL.completion = 'started';
    }
  };

  const onPublishSetVanityURLLog = (msg: PublishSetVanityURLLog) => {
    const localId = getLocalId(msg);
    console.log('onPublishSetVanityURLLog', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.setVanityURL.logs.push(msg);
    }
  };

  const onPublishSetVanityURLSuccess = (msg: PublishSetVanityURLSuccess) => {
    const localId = getLocalId(msg);
    console.log('onPublishSetVanityURLSuccess', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.setVanityURL.completion = 'success';
    }
  };

  const onPublishSetVanityURLFailure = (msg: PublishSetVanityURLFailure) => {
    const localId = getLocalId(msg);
    console.log('onPublishSetVanityURLFailure', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.runContent.completion = 'error';
      publishStatus.steps.setVanityURL.error = msg.error;
    }
  };

  const onPublishValidateDeploymentStart = (msg: PublishValidateDeploymentStart) => {
    const localId = getLocalId(msg);
    console.log('onPublishValidateDeploymentStart', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.validateDeployment.completion = 'started';
    }
  };

  const onPublishValidateDeploymentLog = (msg: PublishValidateDeploymentLog) => {
    const localId = getLocalId(msg);
    console.log('onPublishValidateDeploymentLog', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.validateDeployment.logs.push(msg);
    }
  };

  const onPublishValidateDeploymentSuccess = (msg: PublishValidateDeploymentSuccess) => {
    const localId = getLocalId(msg);
    console.log('onPublishValidateDeploymentSuccess', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.validateDeployment.completion = 'success';
    }
  };

  const onPublishValidateDeploymentFailure = (msg: PublishValidateDeploymentFailure) => {
    const localId = getLocalId(msg);
    console.log('onPublishValidateDeploymentFailure', JSON.stringify(msg));

    const publishStatus = publishStatusMap.value.get(localId);
    if (publishStatus) {
      publishStatus.steps.validateDeployment.completion = 'error';
      publishStatus.steps.validateDeployment.error = msg.error;
    }
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

    // NOT SEEING THESE LOG messages now.
    eventStream.addEventMonitorCallback('agent/log', onAgentLog);

    eventStream.addEventMonitorCallback('publish/start', onPublishStart);
    eventStream.addEventMonitorCallback('publish/start', onPublishStart);
    eventStream.addEventMonitorCallback('publish/success', onPublishSuccess);
    eventStream.addEventMonitorCallback('publish/failure', onPublishFailure);

    eventStream.addEventMonitorCallback('publish/createNewDeployment/start', onPublishCreateNewDeploymentStart);
    eventStream.addEventMonitorCallback('publish/createNewDeployment/success', onPublishCreateNewDeploymentSuccess);
    eventStream.addEventMonitorCallback('publish/createNewDeployment/failure', onPublishCreateNewDeploymentFailure);

    eventStream.addEventMonitorCallback('publish/setEnvVars/start', onPublishSetEnvVarsStart);
    eventStream.addEventMonitorCallback('publish/setEnvVars/success', onPublishSetEnvVarsSuccess);
    eventStream.addEventMonitorCallback('publish/setEnvVars/failure', onPublishSetEnvVarsFailure);

    eventStream.addEventMonitorCallback('publish/createBundle/start', onPublishCreateBundleStart);
    eventStream.addEventMonitorCallback('publish/createBundle/log', onPublishCreateBundleLog);
    eventStream.addEventMonitorCallback('publish/createBundle/success', onPublishCreateBundleSuccess);
    eventStream.addEventMonitorCallback('publish/createBundle/failure', onPublishCreateBundleFailure);

    eventStream.addEventMonitorCallback('publish/createDeployment/start', onPublishCreateDeploymentStart);
    eventStream.addEventMonitorCallback('publish/createDeployment/success', onPublishCreateDeploymentSuccess);
    eventStream.addEventMonitorCallback('publish/createDeployment/failure', onPublishCreateDeploymentFailure);

    eventStream.addEventMonitorCallback('publish/uploadBundle/start', onPublishUploadBundleStart);
    eventStream.addEventMonitorCallback('publish/uploadBundle/success', onPublishUploadBundleSuccess);
    eventStream.addEventMonitorCallback('publish/uploadBundle/failure', onPublishUploadBundleFailure);

    eventStream.addEventMonitorCallback('publish/deployBundle/start', onPublishDeployBundleStart);
    eventStream.addEventMonitorCallback('publish/deployBundle/success', onPublishDeployBundleSuccess);
    eventStream.addEventMonitorCallback('publish/deployBundle/failure', onPublishDeployBundleFailure);

    // 'publish/restore' | // found during agent code searches but not received
    // 'publish/restore/log' | // found during agent code searches but not received

    eventStream.addEventMonitorCallback('publish/restorePythonEnv/start', onPublishRestorePythonEnvStart);
    eventStream.addEventMonitorCallback('publish/restorePythonEnv/log', onPublishRestorePythonEnvLog);
    eventStream.addEventMonitorCallback('publish/restorePythonEnv/progress', onPublishRestorePythonEnvProgress);
    eventStream.addEventMonitorCallback('publish/restorePythonEnv/status', onPublishRestorePythonEnvStatus);
    eventStream.addEventMonitorCallback('publish/restorePythonEnv/success', onPublishRestorePythonEnvSuccess);
    eventStream.addEventMonitorCallback('publish/restorePythonEnv/failure', onPublishRestorePythonEnvFailure);
    // 'publish/restorePythonEnv/failure/serverErr' | // received but temporarily converted

    eventStream.addEventMonitorCallback('publish/runContent/start', onPublishRunContentStart);
    eventStream.addEventMonitorCallback('publish/runContent/log', onPublishRunContentLog);
    eventStream.addEventMonitorCallback('publish/runContent/success', onPublishRunContentSuccess);
    eventStream.addEventMonitorCallback('publish/runContent/failure', onPublishRunContentFailure);

    eventStream.addEventMonitorCallback('publish/setVanityURL/start', onPublishSetVanityURLStart);
    eventStream.addEventMonitorCallback('publish/setVanityURL/log', onPublishSetVanityURLLog);
    eventStream.addEventMonitorCallback('publish/setVanityURL/success', onPublishSetVanityURLSuccess);
    eventStream.addEventMonitorCallback('publish/setVanityURL/failure', onPublishSetVanityURLFailure);

    eventStream.addEventMonitorCallback('publish/validateDeployment/start', onPublishValidateDeploymentStart);
    eventStream.addEventMonitorCallback('publish/validateDeployment/log', onPublishValidateDeploymentLog);
    eventStream.addEventMonitorCallback('publish/validateDeployment/success', onPublishValidateDeploymentSuccess);
    eventStream.addEventMonitorCallback('publish/validateDeployment/failure', onPublishValidateDeploymentFailure);

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

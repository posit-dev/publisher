// Copyright (C) 2023 by Posit Software, PBC.

import { defineStore } from 'pinia';
import { useApi } from 'src/api';

import {
  EventStreamMessage,
  PublishStart,
  PublishSuccess,
  PublishFailure,
  getLocalId,
  PublishCheckCapabilitiesStart,
  PublishCheckCapabilitiesLog,
  PublishCheckCapabilitiesSuccess,
  PublishCheckCapabilitiesFailure,
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
  PublishValidateDeploymentStart,
  PublishValidateDeploymentLog,
  PublishValidateDeploymentSuccess,
  PublishValidateDeploymentFailure,
  AgentLog,
} from 'src/api/types/events';

import {
  useEventStream,
} from 'src/plugins/eventStream';

import { computed, ref } from 'vue';

export type PublishStepCompletionStatus =
'notStarted' | 'inProgress' | 'success' | 'error';

export const publishStepCompletionStatusNames: Record<PublishStepCompletionStatus, string> = {
  notStarted: 'Not Started',
  inProgress: 'In Progress',
  success: 'Completed Successfully',
  error: 'Resulted in Error',
};

export type PublishStep =
  'checkCapabilities' |
  'createNewDeployment' |
  'createBundle' |
  'uploadBundle' |
  'createDeployment' |
  'setEnvVars' |
  'deployBundle' |
  'restorePythonEnv' |
  'runContent' |
  'validateDeployment';

export const publishStepDisplayNames: Record<PublishStep, string> = {
  checkCapabilities: 'Check Capabilities',
  createNewDeployment: 'Create New Deployment',
  createBundle: 'Create Bundle',
  uploadBundle: 'Upload Bundle',
  createDeployment: 'Create Deployment',
  setEnvVars: 'Set Environment Varables',
  deployBundle: 'Deploy Bundle',
  restorePythonEnv: 'Restore Python Runtime Environment',
  runContent: 'Run Content',
  validateDeployment: 'Validate Deployment',
};

export const publishStepOrder: Record<PublishStep, number> = {
  checkCapabilities: 1,
  createNewDeployment: 2,
  createBundle: 3,
  uploadBundle: 4,
  createDeployment: 5,
  setEnvVars: 6,
  deployBundle: 7,
  restorePythonEnv: 8,
  runContent: 9,
  validateDeployment: 10,
};

export type PublishStepStatusBase = {
  completion: PublishStepCompletionStatus;
  error?: keyValuePair[];
  lastLogMsg?: string;
  logs: EventStreamMessage[];
  status?: Record<string, string>[];
  progress?: string[];
  allMsgs: EventStreamMessage[];
}

export type PublishStepStatus = PublishStepStatusBase & {
  allMsgs: EventStreamMessage[];
}

export type PublishStatus = {
  completion: PublishStepCompletionStatus;
  error?: keyValuePair[];
  dashboardURL: string,
  directURL: string,
  currentStep?: PublishStep,
  steps: {
    checkCapabilities: PublishStepStatus,
    createNewDeployment: PublishStepStatus,
    createBundle: PublishStepStatus,
    uploadBundle: PublishStepStatus,
    createDeployment: PublishStepStatus,
    setEnvVars: PublishStepStatus,
    deployBundle: PublishStepStatus,
    restorePythonEnv: PublishStepStatus,
    runContent: PublishStepStatus,
    validateDeployment: PublishStepStatus,
  },
}

const agentLogs = ref<EventStreamMessage[]>([]);

const newPublishStatus = () => {
  return {
    completion: <PublishStepCompletionStatus>'notStarted',
    error: undefined,
    dashboardURL: '',
    directURL: '',
    currentStep: undefined,
    steps: {
      checkCapabilities: {
        completion: <PublishStepCompletionStatus>'notStarted',
        logs: <EventStreamMessage[]>[],
        allMsgs: <EventStreamMessage[]>[],
      },
      createNewDeployment: {
        completion: <PublishStepCompletionStatus>'notStarted',
        logs: <EventStreamMessage[]>[],
        allMsgs: <EventStreamMessage[]>[],
      },
      createBundle: {
        completion: <PublishStepCompletionStatus>'notStarted',
        logs: <EventStreamMessage[]>[],
        allMsgs: <EventStreamMessage[]>[],
      },
      uploadBundle: {
        completion: <PublishStepCompletionStatus>'notStarted',
        logs: <EventStreamMessage[]>[],
        allMsgs: <EventStreamMessage[]>[],
      },
      createDeployment: {
        completion: <PublishStepCompletionStatus>'notStarted',
        logs: <EventStreamMessage[]>[],
        allMsgs: <EventStreamMessage[]>[],
      },
      setEnvVars: {
        completion: <PublishStepCompletionStatus>'notStarted',
        logs: <EventStreamMessage[]>[],
        allMsgs: <EventStreamMessage[]>[],
      },
      deployBundle: {
        completion: <PublishStepCompletionStatus>'notStarted',
        logs: <EventStreamMessage[]>[],
        allMsgs: <EventStreamMessage[]>[],
      },
      restorePythonEnv: {
        completion: <PublishStepCompletionStatus>'notStarted',
        logs: <EventStreamMessage[]>[],
        allMsgs: <EventStreamMessage[]>[],
      },
      runContent: {
        completion: <PublishStepCompletionStatus>'notStarted',
        logs: <EventStreamMessage[]>[],
        allMsgs: <EventStreamMessage[]>[],
      },
      validateDeployment: {
        completion: <PublishStepCompletionStatus>'notStarted',
        logs: <EventStreamMessage[]>[],
        allMsgs: <EventStreamMessage[]>[],
      },
    },
  };
};

export type keyValuePair = {
  key: string,
  value: string,
};

export type DeploymentMode = 'deploy' | 'redeploy';

export const splitMsgIntoKeyValuePairs = ((msg: Record<string, string>) => {
  const result: keyValuePair[] = [];
  Object.keys(msg).forEach(key => result.push({
    key,
    value: msg[key],
  }));
  return result;
});

export const useEventStore = defineStore('event', () => {
  const eventStream = useEventStream();

  const api = useApi();

  const publishInProgess = ref(false);
  const latestLocalId = ref('');

  type CurrentPublishStatus = {
    localId: string,
    contentId: string,
    deploymentMode?: DeploymentMode,
    saveName?: string,
    destinationURL?: string,
    status: PublishStatus,
  };

  const currentPublishStatus = ref<CurrentPublishStatus>({
    localId: '',
    contentId: '',
    deploymentMode: undefined,
    saveName: undefined,
    destinationURL: undefined,
    status: newPublishStatus(),
  });

  const doesPublishStatusApply = ((id: string) => {
    return (
      id &&
      (
        currentPublishStatus.value.localId === id ||
        currentPublishStatus.value.contentId === id
      )
    );
  });

  const isPublishActiveByID = ((id: string) => {
    return (
      publishInProgess.value &&
      doesPublishStatusApply(id)
    );
  });

  const numberOfPublishSteps = () => {
    return Object.keys(publishStepDisplayNames).length;
  };

  const summaryOfCurrentPublishingProcess = computed(() => {
    const currentStep = currentPublishStatus.value.status.currentStep;
    if (!currentStep) {
      return {
        operation: 'Publishing not currently in progress',
        stepStatus: '',
      };
    }
    const currentStepNumber = publishStepOrder[currentStep];
    const operation = `${publishStepDisplayNames[currentStep]} (${currentStepNumber} of ${numberOfPublishSteps()} steps)`;
    let stepStatus;
    const statusList = currentPublishStatus.value.status.steps[currentStep].status;
    if (statusList) {
      const statusMsg = statusList[statusList.length - 1];
      stepStatus = `${statusMsg.message}: ${statusMsg.name}`;
    } else {
      const stepCompletion = currentPublishStatus.value.status.steps[currentStep].completion;
      stepStatus = publishStepCompletionStatusNames[stepCompletion];
    }
    return {
      operation,
      stepStatus,
    };
  });

  const closeEventStream = () => {
    eventStream.close();
  };

  const incomingEvent = (msg: EventStreamMessage) => {
    console.log(msg.type, msg.data);
  };

  const onAgentLog = (msg: AgentLog) => {
    agentLogs.value.push(msg);
  };

  const onPublishStart = (msg: PublishStart) => {
    const localId = getLocalId(msg);

    latestLocalId.value = localId;
    currentPublishStatus.value.localId = localId;
    currentPublishStatus.value.status = newPublishStatus();

    const publishStatus = currentPublishStatus.value.status;
    publishStatus.completion = 'inProgress';
  };

  const onPublishSuccess = (msg: PublishSuccess) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.currentStep = undefined;
      publishStatus.completion = 'success';
      publishStatus.dashboardURL = msg.data.dashboardUrl;
      publishStatus.directURL = msg.data.directUrl;
      currentPublishStatus.value.contentId = msg.data.contentId;
    }
    publishInProgess.value = false;
  };

  const onPublishFailure = (msg: PublishFailure) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.completion = 'error';
      publishStatus.error = splitMsgIntoKeyValuePairs(msg.data);
    }
    publishInProgess.value = false;
  };

  const onPublishCheckCapabilitiesStart = (msg: PublishCheckCapabilitiesStart) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.currentStep = 'checkCapabilities';
      publishStatus.steps.checkCapabilities.completion = 'inProgress';
      publishStatus.steps.checkCapabilities.allMsgs.push(msg);
    }
  };

  const onPublishCheckCapabilitiesLog = (msg: PublishCheckCapabilitiesLog) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.steps.checkCapabilities.logs.push(msg);
      publishStatus.steps.checkCapabilities.allMsgs.push(msg);
    }
  };

  const onPublishCheckCapabilitiesSuccess = (msg: PublishCheckCapabilitiesSuccess) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.steps.checkCapabilities.completion = 'success';
      publishStatus.steps.checkCapabilities.allMsgs.push(msg);
    }
  };

  const onPublishCheckCapabilitiesFailure = (msg: PublishCheckCapabilitiesFailure) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.steps.checkCapabilities.completion = 'error';
      publishStatus.steps.checkCapabilities.error = splitMsgIntoKeyValuePairs(msg.data);
      publishStatus.steps.checkCapabilities.allMsgs.push(msg);
    }
  };

  const onPublishCreateNewDeploymentStart = (msg: PublishCreateNewDeploymentStart) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.currentStep = 'createNewDeployment';
      publishStatus.steps.createNewDeployment.completion = 'inProgress';
      publishStatus.steps.createNewDeployment.allMsgs.push(msg);
    }
  };

  const onPublishCreateNewDeploymentSuccess = (msg: PublishCreateNewDeploymentSuccess) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.steps.createNewDeployment.completion = 'success';
      publishStatus.steps.createNewDeployment.allMsgs.push(msg);
    }
  };

  const onPublishCreateNewDeploymentFailure = (msg: PublishCreateNewDeploymentFailure) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.steps.createNewDeployment.completion = 'error';
      publishStatus.steps.createNewDeployment.error = splitMsgIntoKeyValuePairs(msg.data);
      publishStatus.steps.createNewDeployment.allMsgs.push(msg);
    }
  };

  const onPublishCreateBundleStart = (msg: PublishCreateBundleStart) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.currentStep = 'createBundle';
      publishStatus.steps.createBundle.completion = 'inProgress';
      publishStatus.steps.createBundle.allMsgs.push(msg);
    }
  };

  const onPublishCreateBundleLog = (msg: PublishCreateBundleLog) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.steps.createBundle.logs.push(msg);
      publishStatus.steps.createBundle.allMsgs.push(msg);
    }
  };

  const onPublishCreateBundleSuccess = (msg: PublishCreateBundleSuccess) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.steps.createBundle.completion = 'success';
      publishStatus.steps.createBundle.allMsgs.push(msg);
    }
  };

  const onPublishCreateBundleFailure = (msg: PublishCreateBundleFailure) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.steps.createBundle.completion = 'error';
      publishStatus.steps.createBundle.error = splitMsgIntoKeyValuePairs(msg.data);
      publishStatus.steps.createBundle.allMsgs.push(msg);
    }
  };

  const onPublishUploadBundleStart = (msg: PublishUploadBundleStart) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.currentStep = 'uploadBundle';
      publishStatus.steps.uploadBundle.completion = 'inProgress';
      publishStatus.steps.uploadBundle.allMsgs.push(msg);
    }
  };

  const onPublishUploadBundleSuccess = (msg: PublishUploadBundleSuccess) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.steps.uploadBundle.completion = 'success';
      publishStatus.steps.uploadBundle.allMsgs.push(msg);
    }
  };

  const onPublishUploadBundleFailure = (msg: PublishUploadBundleFailure) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.steps.uploadBundle.completion = 'error';
      publishStatus.steps.uploadBundle.error = splitMsgIntoKeyValuePairs(msg.data);
      publishStatus.steps.uploadBundle.allMsgs.push(msg);
    }
  };

  const onPublishCreateDeploymentStart = (msg: PublishCreateDeploymentStart) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.currentStep = 'createDeployment';
      publishStatus.steps.createDeployment.completion = 'inProgress';
      publishStatus.steps.createDeployment.allMsgs.push(msg);
    }
  };

  const onPublishCreateDeploymentSuccess = (msg: PublishCreateDeploymentSuccess) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.steps.createDeployment.completion = 'success';
      publishStatus.steps.createDeployment.allMsgs.push(msg);
    }
  };

  const onPublishCreateDeploymentFailure = (msg: PublishCreateDeploymentFailure) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.steps.createDeployment.completion = 'error';
      publishStatus.steps.createDeployment.error = splitMsgIntoKeyValuePairs(msg.data);
      publishStatus.steps.createDeployment.allMsgs.push(msg);
    }
  };

  const onPublishSetEnvVarsStart = (msg: PublishSetEnvVarsStart) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.currentStep = 'setEnvVars';
      publishStatus.steps.setEnvVars.completion = 'inProgress';
      publishStatus.steps.setEnvVars.allMsgs.push(msg);
    }
  };

  const onPublishSetEnvVarsSuccess = (msg: PublishSetEnvVarsSuccess) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.steps.setEnvVars.completion = 'success';
      publishStatus.steps.setEnvVars.allMsgs.push(msg);
    }
  };
  const onPublishSetEnvVarsFailure = (msg: PublishSetEnvVarsFailure) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.steps.setEnvVars.completion = 'error';
      publishStatus.steps.setEnvVars.error = splitMsgIntoKeyValuePairs(msg.data);
      publishStatus.steps.setEnvVars.allMsgs.push(msg);
    }
  };

  const onPublishDeployBundleStart = (msg: PublishDeployBundleStart) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.currentStep = 'deployBundle';
      publishStatus.steps.deployBundle.completion = 'inProgress';
      publishStatus.steps.deployBundle.allMsgs.push(msg);
    }
  };

  const onPublishDeployBundleSuccess = (msg: PublishDeployBundleSuccess) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.steps.deployBundle.completion = 'success';
      publishStatus.steps.deployBundle.allMsgs.push(msg);
    }
  };

  const onPublishDeployBundleFailure = (msg: PublishDeployBundleFailure) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.steps.uploadBundle.completion = 'error';
      publishStatus.steps.deployBundle.error = splitMsgIntoKeyValuePairs(msg.data);
      publishStatus.steps.deployBundle.allMsgs.push(msg);
    }
  };

  const onPublishRestorePythonEnvStart = (msg: PublishRestorePythonEnvStart) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.currentStep = 'restorePythonEnv';
      publishStatus.steps.restorePythonEnv.completion = 'inProgress';
      publishStatus.steps.restorePythonEnv.allMsgs.push(msg);
    }
  };

  const onPublishRestorePythonEnvLog = (msg: PublishRestorePythonEnvLog) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.steps.restorePythonEnv.logs.push(msg);
      publishStatus.steps.restorePythonEnv.allMsgs.push(msg);
    }
  };

  const onPublishRestorePythonEnvProgress = (msg: PublishRestorePythonEnvProgress) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      if (!publishStatus.steps.restorePythonEnv.progress) {
        publishStatus.steps.restorePythonEnv.progress = [];
      }
      publishStatus.steps.restorePythonEnv.progress.push(JSON.stringify(msg.data));
      publishStatus.steps.restorePythonEnv.allMsgs.push(msg);
    }
  };

  const onPublishRestorePythonEnvStatus = (msg: PublishRestorePythonEnvStatus) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      if (!publishStatus.steps.restorePythonEnv.status) {
        publishStatus.steps.restorePythonEnv.status = [];
      }
      publishStatus.steps.restorePythonEnv.status.push(msg.data);
      publishStatus.steps.restorePythonEnv.allMsgs.push(msg);
      // status msg.data = {
      //     "level": "INFO",
      //     "message": "Package restore",
      //     "localId": "E_JAH58AYf5l7bLq",
      //     "name": "setuptools",
      //     "runtime": "python",
      //     "source": "server.log",
      //     "status": "install",
      //     "version": ""
      // }
    }
  };

  const onPublishRestorePythonEnvSuccess = (msg: PublishRestorePythonEnvSuccess) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.steps.restorePythonEnv.completion = 'success';
      publishStatus.steps.restorePythonEnv.allMsgs.push(msg);
    }
  };

  const onPublishRestorePythonEnvFailure = (msg: PublishRestorePythonEnvFailure) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.steps.uploadBundle.completion = 'error';
      publishStatus.steps.restorePythonEnv.error = splitMsgIntoKeyValuePairs(msg.data);
      publishStatus.steps.restorePythonEnv.allMsgs.push(msg);
    }
  };

  const onPublishRunContentStart = (msg: PublishRunContentStart) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.currentStep = 'runContent';
      publishStatus.steps.runContent.completion = 'inProgress';
      publishStatus.steps.runContent.allMsgs.push(msg);
    }
  };

  const onPublishRunContentLog = (msg: PublishRunContentLog) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.steps.runContent.logs.push(msg);
      publishStatus.steps.runContent.allMsgs.push(msg);
    }
  };

  const onPublishRunContentSuccess = (msg: PublishRunContentSuccess) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.steps.runContent.completion = 'success';
      publishStatus.steps.runContent.allMsgs.push(msg);
    }
  };

  const onPublishRunContentFailure = (msg: PublishRunContentFailure) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.steps.runContent.completion = 'error';
      publishStatus.steps.runContent.error = splitMsgIntoKeyValuePairs(msg.data);
      publishStatus.steps.runContent.allMsgs.push(msg);
    }
  };

  const onPublishValidateDeploymentStart = (msg: PublishValidateDeploymentStart) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.currentStep = 'validateDeployment';
      publishStatus.steps.validateDeployment.completion = 'inProgress';
      publishStatus.steps.validateDeployment.allMsgs.push(msg);
    }
  };

  const onPublishValidateDeploymentLog = (msg: PublishValidateDeploymentLog) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.steps.validateDeployment.logs.push(msg);
      publishStatus.steps.validateDeployment.allMsgs.push(msg);
    }
  };

  const onPublishValidateDeploymentSuccess = (msg: PublishValidateDeploymentSuccess) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.steps.validateDeployment.completion = 'success';
      publishStatus.steps.validateDeployment.allMsgs.push(msg);
    }
  };

  const onPublishValidateDeploymentFailure = (msg: PublishValidateDeploymentFailure) => {
    const localId = getLocalId(msg);

    if (currentPublishStatus.value.localId === localId) {
      const publishStatus = currentPublishStatus.value.status;
      publishStatus.steps.validateDeployment.completion = 'error';
      publishStatus.steps.validateDeployment.error = splitMsgIntoKeyValuePairs(msg.data);
      publishStatus.steps.validateDeployment.allMsgs.push(msg);
    }
  };

  // Will throw Error or API exceptions
  const initiatePublishProcessWithEvents = async(
    newDeployment: boolean,
    accountName : string,
    destinationName: string,
    destinationURL?: string,
    contentId?: string,
  ) : Promise<string> => {
    if (publishInProgess.value) {
      throw new Error('Publishing already in progress');
    }

    publishInProgess.value = true;
    currentPublishStatus.value.localId = '';
    currentPublishStatus.value.contentId = contentId || '';
    currentPublishStatus.value.deploymentMode = newDeployment ? 'deploy' : 'redeploy';
    currentPublishStatus.value.saveName = destinationName;
    currentPublishStatus.value.destinationURL = destinationURL;
    currentPublishStatus.value.status = newPublishStatus();

    try {
      if (newDeployment) {
        await api.deployments.createNew(
          accountName,
          destinationName,
        );
      }
      // Returns:
      // 200 - success
      // 400 - bad request
      // 500 - internal server error
      // Errors returned through event stream
      // Handle errors at the top level caller
      const response = await api.deployments.publish(
        destinationName,
        accountName,
      );

      const localId = <string>response.data.localId;
      currentPublishStatus.value.localId = localId;
      return localId;
    } catch (error) {
      publishInProgess.value = false;
      // need to re-throw to be handled by caller.
      throw error;
    }
  };

  const init = () => {
    eventStream.addEventMonitorCallback('*', incomingEvent);

    // NOT SEEING THESE LOG messages now.
    eventStream.addEventMonitorCallback('agent/log', onAgentLog);

    eventStream.addEventMonitorCallback('publish/start', onPublishStart);
    eventStream.addEventMonitorCallback('publish/success', onPublishSuccess);
    eventStream.addEventMonitorCallback('publish/failure', onPublishFailure);

    eventStream.addEventMonitorCallback('publish/checkCapabilities/start', onPublishCheckCapabilitiesStart);
    eventStream.addEventMonitorCallback('publish/checkCapabilities/log', onPublishCheckCapabilitiesLog);
    eventStream.addEventMonitorCallback('publish/checkCapabilities/success', onPublishCheckCapabilitiesSuccess);
    eventStream.addEventMonitorCallback('publish/checkCapabilities/failure', onPublishCheckCapabilitiesFailure);

    eventStream.addEventMonitorCallback('publish/createNewDeployment/start', onPublishCreateNewDeploymentStart);
    eventStream.addEventMonitorCallback('publish/createNewDeployment/success', onPublishCreateNewDeploymentSuccess);
    eventStream.addEventMonitorCallback('publish/createNewDeployment/failure', onPublishCreateNewDeploymentFailure);

    eventStream.addEventMonitorCallback('publish/createBundle/start', onPublishCreateBundleStart);
    eventStream.addEventMonitorCallback('publish/createBundle/log', onPublishCreateBundleLog);
    eventStream.addEventMonitorCallback('publish/createBundle/success', onPublishCreateBundleSuccess);
    eventStream.addEventMonitorCallback('publish/createBundle/failure', onPublishCreateBundleFailure);

    eventStream.addEventMonitorCallback('publish/uploadBundle/start', onPublishUploadBundleStart);
    eventStream.addEventMonitorCallback('publish/uploadBundle/success', onPublishUploadBundleSuccess);
    eventStream.addEventMonitorCallback('publish/uploadBundle/failure', onPublishUploadBundleFailure);

    eventStream.addEventMonitorCallback('publish/createDeployment/start', onPublishCreateDeploymentStart);
    eventStream.addEventMonitorCallback('publish/createDeployment/success', onPublishCreateDeploymentSuccess);
    eventStream.addEventMonitorCallback('publish/createDeployment/failure', onPublishCreateDeploymentFailure);

    eventStream.addEventMonitorCallback('publish/setEnvVars/start', onPublishSetEnvVarsStart);
    eventStream.addEventMonitorCallback('publish/setEnvVars/success', onPublishSetEnvVarsSuccess);
    eventStream.addEventMonitorCallback('publish/setEnvVars/failure', onPublishSetEnvVarsFailure);

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

    eventStream.addEventMonitorCallback('publish/validateDeployment/start', onPublishValidateDeploymentStart);
    eventStream.addEventMonitorCallback('publish/validateDeployment/log', onPublishValidateDeploymentLog);
    eventStream.addEventMonitorCallback('publish/validateDeployment/success', onPublishValidateDeploymentSuccess);
    eventStream.addEventMonitorCallback('publish/validateDeployment/failure', onPublishValidateDeploymentFailure);

    eventStream.setDebugMode(false);
    eventStream.open('api/events?stream=messages');
  };
  init();

  return {
    closeEventStream,
    currentPublishStatus,
    publishInProgess,
    initiatePublishProcessWithEvents,
    latestLocalId,
    isPublishActiveByID,
    doesPublishStatusApply,
    publishStepDisplayNames,
    publishStepOrder,
    publishStepCompletionStatusNames,
    numberOfPublishSteps,
    summaryOfCurrentPublishingProcess,
  };
});

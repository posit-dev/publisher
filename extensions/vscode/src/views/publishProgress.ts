import { window, ProgressLocation } from 'vscode';
import { EventStream, EventStreamMessage } from '../events';

export function initiatePublishing(localID: string, stream: EventStream) {
  window.withProgress({
    location: ProgressLocation.Notification,
    title: `Publishing Project associated with id: ${localID}`,
    cancellable: true
  }, (progress, token) => {
    let resolveCB: (reason?: any) => void;
    let rejectCB: (reason?: any) => void;
    // const registrations: {
    //   unregister: () => void;
    // }[] = [];

    const promise = new Promise<void>((resolve, reject) => {
      resolveCB = resolve;
      rejectCB = reject;
    });

    // registrations.push(
    stream.register('publish/start', (msg: EventStreamMessage) => {
      if (localID === msg.data.localId) {
        progress.report({ increment: 0 });
        progress.report({ message: "Starting to Deploy..." });
      }
    });
    // );

    let progressCount = 0;
    const handleProgressMessages = (msg: EventStreamMessage) => {
      if (localID === msg.data.localId) {
        // const outputStr = displayEventStreamMessage(msg);
        progress.report({ increment: progressCount++, message: msg.type });
      }
    };

    stream.register('publish/checkCapabilities/start', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/checkCapabilities/log', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/checkCapabilities/success', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/checkCapabilities/failure', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/createNewDeployment/start', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/createNewDeployment/success', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/createNewDeployment/failure', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/setEnvVars/start', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/setEnvVars/success', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/setEnvVars/failure', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/createBundle/start', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/createBundle/success', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/createBundle/failure', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/createBundle/failure', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/createDeployment/start', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/createDeployment/success', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/createDeployment/failure', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/createDeployment/log', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/uploadBundle/start', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/uploadBundle/success', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/uploadBundle/failure', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/uploadBundle/log', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/deployBundle/start', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/deployBundle/success', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/deployBundle/failure', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/deployBundle/log', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/restorePythonEnv/start', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/restorePythonEnv/success', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/restorePythonEnv/failure', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/restorePythonEnv/log', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/restorePythonEnv/progress', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/restorePythonEnv/status', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/runContent/start', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/runContent/success', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/runContent/failure', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/runContent/log', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/setVanityURL/start', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/setVanityURL/success', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/setVanityURL/failure', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/setVanityURL/log', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/validateDeployment/start', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/validateDeployment/success', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/validateDeployment/failure', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });
    stream.register('publish/validateDeployment/log', (msg: EventStreamMessage) => {
      handleProgressMessages(msg);
    });

    // registrations.push(
    stream.register('publish/success', (msg: EventStreamMessage) => {
      if (localID === msg.data.localId) {
        progress.report({ increment: 100, message: "Deployment was successful" });
        resolveCB('Success!');
      }
    });
    // );

    // registrations.push(
    stream.register('publish/failure', (msg: EventStreamMessage) => {
      if (localID === msg.data.localId) {
        progress.report({ increment: 100, message: "Deployment process encountered an error " });
        rejectCB('Error Encountered!');
      }
    });
    // );

    token.onCancellationRequested(() => {
      console.log("User canceled the long running operation");
    });

    return promise;
  });
}
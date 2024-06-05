// Copyright (C) 2023 by Posit Software, PBC.

export enum EventSourceReadyState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSED = 2,
}

export enum EventStreamMessageType {
  ERROR = "error",
  LOG = "log",
}

export type MethodResult = {
  ok: boolean;
  error?: string;
};

export type EventStatus = {
  isOpen?: boolean;
  eventSource: string;
  withCredentials?: boolean;
  readyState?: EventSourceReadyState;
  url: string | null;
  lastError: string | null;
};

export type CallbackQueueEntry = {
  eventType: EventSubscriptionTarget;
  callback: OnMessageEventSourceCallback;
};

export type EventSubscriptionTarget = keyof EventSubscriptionTargetCallbackMap;

/**
 * Mapping of event subscription targets to callback signatures.
 */
export interface EventSubscriptionTargetCallbackMap {
  // all events
  "*": OnMessageEventSourceCallback;

  // agent console log messages
  "agent/log": OnAgentLogCallback;

  // all errors
  "errors/*": OnMessageEventSourceCallback;
  "errors/sse": OnErrorsSseCallback;
  "errors/open": OnErrorsOpenCallback;
  "errors/unknownEvent": OnErrorsUnknownEventCallback;

  // open events
  "open/*": OnMessageEventSourceCallback;
  "open/sse": OnOpenSseCallback;

  // publish events
  "publish/*": OnMessageEventSourceCallback;
  "publish/**/log": OnMessageEventSourceCallback;
  "publish/**/failure": OnMessageEventSourceCallback;
  "publish/start": OnPublishStartCallback;

  "publish/checkCapabilities/start": OnPublishCheckCapabilitiesStartCallback;
  "publish/checkCapabilities/log": OnPublishCheckCapabilitiesLogCallback;
  "publish/checkCapabilities/success": OnPublishCheckCapabilitiesSuccessCallback;
  "publish/checkCapabilities/failure": OnPublishCheckCapabilitiesFailureCallback;

  // 'publish/createBundle/failure/authFailure' | // received but temporarily converted
  "publish/createNewDeployment/start": OnPublishCreateNewDeploymentStartCallback;
  "publish/createNewDeployment/success": OnPublishCreateNewDeploymentSuccessCallback;
  "publish/createNewDeployment/failure": OnPublishCreateNewDeploymentFailureCallback;

  "publish/setEnvVars/start": OnPublishSetEnvVarsStartCallback;
  "publish/setEnvVars/success": OnPublishSetEnvVarsSuccessCallback;
  "publish/setEnvVars/failure": OnPublishSetEnvVarsFailureCallback;

  "publish/createBundle/start": OnPublishCreateBundleStartCallback;
  "publish/createBundle/log": OnPublishCreateBundleLogCallback;
  "publish/createBundle/success": OnPublishCreateBundleSuccessCallback;
  "publish/createBundle/failure": OnPublishCreateBundleFailureCallback;

  "publish/createDeployment/start": OnPublishCreateDeploymentStartCallback;
  "publish/createDeployment/log": OnPublishCreateDeploymentLogCallback;
  "publish/createDeployment/success": OnPublishCreateDeploymentSuccessCallback;
  "publish/createDeployment/failure": OnPublishCreateDeploymentFailureCallback;

  "publish/uploadBundle/start": OnPublishUploadBundleStartCallback;
  "publish/uploadBundle/log": OnPublishUploadBundleLogCallback;
  "publish/uploadBundle/success": OnPublishUploadBundleSuccessCallback;
  "publish/uploadBundle/failure": OnPublishUploadBundleFailureCallback;

  "publish/deployBundle/start": OnPublishDeployBundleStartCallback;
  "publish/deployBundle/log": OnPublishDeployBundleLogCallback;
  "publish/deployBundle/success": OnPublishDeployBundleSuccessCallback;
  "publish/deployBundle/failure": OnPublishDeployBundleFailureCallback;

  "publish/restorePythonEnv/start": OnPublishRestorePythonEnvStartCallback;
  "publish/restorePythonEnv/log": OnPublishRestorePythonEnvLogCallback;
  "publish/restorePythonEnv/progress": OnPublishRestorePythonEnvProgressCallback;
  "publish/restorePythonEnv/status": OnPublishRestorePythonEnvStatusCallback;
  "publish/restorePythonEnv/success": OnPublishRestorePythonEnvSuccessCallback;
  "publish/restorePythonEnv/failure": OnPublishRestorePythonEnvFailureCallback;
  // 'publish/restorePythonEnv/failure/serverErr' | // received but temporarily converted

  "publish/restoreREnv/start": OnPublishRestoreREnvStartCallback;
  "publish/restoreREnv/log": OnPublishRestoreREnvLogCallback;
  "publish/restoreREnv/progress": OnPublishRestoreREnvProgressCallback;
  "publish/restoreREnv/status": OnPublishRestoreREnvStatusCallback;
  "publish/restoreREnv/success": OnPublishRestoreREnvSuccessCallback;
  "publish/restoreREnv/failure": OnPublishRestoreREnvFailureCallback;
  // 'publish/restoreREnv/failure/serverErr' | // received but temporarily converted

  // This set of messages originate here, and are built from the
  // publish/restorePythonEnv and publish/restoreREnv messages
  "publish/restoreEnv/start": OnPublishRestoreEnvStartCallback;
  "publish/restoreEnv/log": OnPublishRestoreEnvLogCallback;
  "publish/restoreEnv/progress": OnPublishRestoreEnvProgressCallback;
  "publish/restoreEnv/status": OnPublishRestoreEnvStatusCallback;
  "publish/restoreEnv/success": OnPublishRestoreEnvSuccessCallback;
  "publish/restoreEnv/failure": OnPublishRestoreEnvFailureCallback;

  "publish/runContent/start": OnPublishRunContentStartCallback;
  "publish/runContent/log": OnPublishRunContentLogCallback;
  "publish/runContent/success": OnPublishRunContentSuccessCallback;
  "publish/runContent/failure": OnPublishRunContentFailureCallback;

  "publish/setVanityURL/start": OnPublishSetVanityURLStartCallback;
  "publish/setVanityURL/log": OnPublishSetVanityURLLogCallback;
  "publish/setVanityURL/success": OnPublishSetVanityURLSuccessCallback;
  "publish/setVanityURL/failure": OnPublishSetVanityURLFailureCallback;

  "publish/validateDeployment/start": OnPublishValidateDeploymentStartCallback;
  "publish/validateDeployment/log": OnPublishValidateDeploymentLogCallback;
  "publish/validateDeployment/success": OnPublishValidateDeploymentSuccessCallback;
  "publish/validateDeployment/failure": OnPublishValidateDeploymentFailureCallback;

  "publish/success": OnPublishSuccessCallback;
  "publish/failure": OnPublishFailureCallback;
}

export const eventMsgToString = (msg: EventStreamMessage): string => {
  let suffix: string | undefined;
  if (isPublishRestorePythonEnvStatus(msg) || isPublishRestoreREnvStatus(msg)) {
    suffix = msg.data.name;
    if (msg.data.version) {
      suffix = `${suffix} (${msg.data.version})...`;
    } else {
      suffix = `${suffix}...`;
    }
  }

  if (suffix) {
    return `${eventTypeToString(msg.type)} - ${suffix}`;
  }
  return eventTypeToString(msg.type);
};

export const eventTypeToString = (eventTypeStr: string): string => {
  const eventVerbToString: Record<string, string> = {
    "publish/checkCapabilities": "Check Capabilities",
    "publish/createBundle": "Create Bundle",
    "publish/uploadBundle": "Upload Bundle",
    "publish/createDeployment": "Create ContentRecord",
    "publish/deployBundle": "Deploy Bundle",
    "publish/restorePythonEnv": "Restore Python Environment",
    "publish/restoreREnv": "Restore R Environment",
    "publish/runContent": "Run Content",
    "publish/setVanityURL": "Set Vanity URL",
    "publish/validateDeployment": "Validate ContentRecord",
    "publish/success": "Wrapping up ContentRecord",
  };

  // we do not provide strings for wildcards
  if (eventTypeStr.includes("*")) {
    return eventTypeStr;
  }

  // not in the format we're expecting
  const parts = eventTypeStr.split("/");
  if (parts.length !== 3) {
    return eventTypeStr;
  }

  const verb = `${parts[0]}/${parts[1]}`;
  const base = eventVerbToString[verb];

  // we don't know about this event
  if (base === undefined) {
    return eventTypeStr;
  }

  return base;
};

export function getLocalId(arg: EventStreamMessage) {
  return arg.data.localId;
}

export interface EventStreamMessage {
  type: EventSubscriptionTarget;
  time: string;
  data: Record<string, string>;
  error?: string;
}

export interface EventStreamMessageWithError extends EventStreamMessage {
  error: string;
}

export function isErrorEventStreamMessage(
  msg: EventStreamMessage,
): msg is EventStreamMessageWithError {
  return msg.error !== undefined;
}

export type OnMessageEventSourceCallback = <T extends EventStreamMessage>(
  msg: T,
) => void;

export function isEventStreamMessage(o: object): o is EventStreamMessage {
  return (
    "type" in o &&
    typeof o.type === "string" &&
    "time" in o &&
    typeof o.time === "string" &&
    "data" in o &&
    typeof o.data === "object"
  );
}

// define interfaces which specialize an EventStreamMessage
// and provide type guards for them to support proper typing.

export interface AgentLog extends EventStreamMessage {
  type: "agent/log";
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnAgentLogCallback = (msg: AgentLog) => void;
export function isAgentLog(arg: Events): arg is AgentLog {
  return arg.type === "agent/log";
}

export interface ErrorsSse extends EventStreamMessage {
  type: "errors/sse";
}
export type OnErrorsSseCallback = (msg: ErrorsSse) => void;
export function isErrorsSse(arg: Events): arg is ErrorsSse {
  return arg.type === "errors/sse";
}

export interface ErrorsOpen extends EventStreamMessage {
  type: "errors/open";
}
export type OnErrorsOpenCallback = (msg: ErrorsOpen) => void;
export function isErrorsOpen(arg: Events): arg is ErrorsOpen {
  return arg.type === "errors/open";
}

export interface ErrorsUnknownEvent extends EventStreamMessage {
  type: "errors/unknownEvent";
}
export type OnErrorsUnknownEventCallback = (msg: ErrorsUnknownEvent) => void;
export function isErrorsUnknownEvent(arg: Events): arg is ErrorsUnknownEvent {
  return arg.type === "errors/unknownEvent";
}

export interface OpenSse extends EventStreamMessage {
  type: "open/sse";
}
export type OnOpenSseCallback = (msg: OpenSse) => void;
export function isOpenSse(arg: Events): arg is OpenSse {
  return arg.type === "open/sse";
}

export interface PublishStart extends EventStreamMessage {
  type: "publish/start";
  data: {
    localId: string;
    server: string;
  };
}
export type OnPublishStartCallback = (msg: PublishStart) => void;
export function isPublishStart(arg: Events): arg is PublishStart {
  return arg.type === "publish/start";
}

export interface PublishCheckCapabilitiesStart extends EventStreamMessage {
  type: "publish/checkCapabilities/start";
  data: {
    localId: string;
  };
}
export type OnPublishCheckCapabilitiesStartCallback = (
  msg: PublishCheckCapabilitiesStart,
) => void;
export function isPublishCheckCapabilitiesStart(
  arg: Events,
): arg is PublishCheckCapabilitiesStart {
  return arg.type === "publish/checkCapabilities/start";
}

export interface PublishCheckCapabilitiesLog extends EventStreamMessage {
  type: "publish/checkCapabilities/log";
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishCheckCapabilitiesLogCallback = (
  msg: PublishCheckCapabilitiesLog,
) => void;
export function isPublishCheckCapabilitiesLog(
  arg: Events,
): arg is PublishCheckCapabilitiesLog {
  return arg.type === "publish/checkCapabilities/log";
}

export interface PublishCheckCapabilitiesSuccess extends EventStreamMessage {
  type: "publish/checkCapabilities/success";
  data: {
    localId: string;
  };
}
export type OnPublishCheckCapabilitiesSuccessCallback = (
  msg: PublishCheckCapabilitiesSuccess,
) => void;
export function isPublishCheckCapabilitiesSuccess(
  arg: Events,
): arg is PublishCheckCapabilitiesSuccess {
  return arg.type === "publish/checkCapabilities/success";
}

export interface PublishCheckCapabilitiesFailure extends EventStreamMessage {
  type: "publish/checkCapabilities/failure";
  error: string; // translated internally
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishCheckCapabilitiesFailureCallback = (
  msg: PublishCheckCapabilitiesFailure,
) => void;
export function isPublishCheckCapabilitiesFailure(
  arg: Events,
): arg is PublishCheckCapabilitiesFailure {
  return arg.type === "publish/checkCapabilities/failure";
}

export interface PublishCreateNewDeploymentStart extends EventStreamMessage {
  type: "publish/createNewDeployment/start";
  data: {
    localId: string;
    saveName: string;
  };
}
export type OnPublishCreateNewDeploymentStartCallback = (
  msg: PublishCreateNewDeploymentStart,
) => void;
export function isPublishCreateNewDeploymentStart(
  arg: Events,
): arg is PublishCreateNewDeploymentStart {
  return arg.type === "publish/createNewDeployment/start";
}

export interface PublishCreateNewDeploymentSuccess extends EventStreamMessage {
  type: "publish/createNewDeployment/success";
  data: {
    localId: string;
    contentId: string;
    saveName: string;
  };
}
export type OnPublishCreateNewDeploymentSuccessCallback = (
  msg: PublishCreateNewDeploymentSuccess,
) => void;
export function isPublishCreateNewDeploymentSuccess(
  arg: Events,
): arg is PublishCreateNewDeploymentSuccess {
  return arg.type === "publish/createNewDeployment/success";
}

export interface PublishCreateNewDeploymentFailure extends EventStreamMessage {
  type: "publish/createNewDeployment/failure";
  error: string; // translated internally
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishCreateNewDeploymentFailureCallback = (
  msg: PublishCreateNewDeploymentFailure,
) => void;
export function isPublishCreateNewDeploymentFailure(
  arg: Events,
): arg is PublishCreateNewDeploymentFailure {
  return arg.type === "publish/createNewDeployment/failure";
}

export interface PublishSetEnvVarsStart extends EventStreamMessage {
  type: "publish/setEnvVars/start";
  data: {
    localId: string;
  };
}
export type OnPublishSetEnvVarsStartCallback = (
  msg: PublishSetEnvVarsStart,
) => void;
export function isPublishSetEnvVarsStart(
  arg: Events,
): arg is PublishSetEnvVarsStart {
  return arg.type === "publish/setEnvVars/start";
}

export interface PublishSetEnvVarsSuccess extends EventStreamMessage {
  type: "publish/setEnvVars/success";
  data: {
    localId: string;
    // should include echo of variables/values
  };
}
export type OnPublishSetEnvVarsSuccessCallback = (
  msg: PublishSetEnvVarsSuccess,
) => void;
export function isPublishSetEnvVarsSuccess(
  arg: Events,
): arg is PublishSetEnvVarsSuccess {
  return arg.type === "publish/setEnvVars/success";
}

export interface PublishSetEnvVarsFailure extends EventStreamMessage {
  type: "publish/setEnvVars/failure";
  error: string; // translated internally
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishSetEnvVarsFailureCallback = (
  msg: PublishSetEnvVarsFailure,
) => void;
export function isPublishSetEnvVarsFailure(
  arg: Events,
): arg is PublishSetEnvVarsFailure {
  return arg.type === "publish/setEnvVars/failure";
}

export interface PublishCreateBundleStart extends EventStreamMessage {
  type: "publish/createBundle/start";
  data: {
    localId: string;
  };
}
export type OnPublishCreateBundleStartCallback = (
  msg: PublishCreateBundleStart,
) => void;
export function isPublishCreateBundleStart(
  arg: Events,
): arg is PublishCreateBundleStart {
  return arg.type === "publish/createBundle/start";
}

export interface PublishCreateBundleLog extends EventStreamMessage {
  type: "publish/createBundle/log";
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishCreateBundleLogCallback = (
  msg: PublishCreateBundleLog,
) => void;
export function isPublishCreateBundleLog(
  arg: Events,
): arg is PublishCreateBundleLog {
  return arg.type === "publish/createBundle/log";
}

export interface PublishCreateBundleSuccess extends EventStreamMessage {
  type: "publish/createBundle/success";
  data: {
    localId: string;
    filename: string;
  };
}
export type OnPublishCreateBundleSuccessCallback = (
  msg: PublishCreateBundleSuccess,
) => void;
export function isPublishCreateBundleSuccess(
  arg: Events,
): arg is PublishCreateBundleSuccess {
  return arg.type === "publish/createBundle/success";
}

export interface PublishCreateBundleFailure extends EventStreamMessage {
  type: "publish/createBundle/failure";
  error: string; // translated internally
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishCreateBundleFailureCallback = (
  msg: PublishCreateBundleFailure,
) => void;
export function isPublishCreateBundleFailure(
  arg: Events,
): arg is PublishCreateBundleFailure {
  return arg.type === "publish/createBundle/failure";
}

export interface PublishCreateDeploymentStart extends EventStreamMessage {
  type: "publish/createDeployment/start";
  data: {
    localId: string;
    contentId: string;
    saveName: string;
  };
}
export type OnPublishCreateDeploymentStartCallback = (
  msg: PublishCreateDeploymentStart,
) => void;
export function isPublishCreateDeploymentStart(
  arg: Events,
): arg is PublishCreateDeploymentStart {
  return arg.type === "publish/createDeployment/start";
}

export interface PublishCreateDeploymentLog extends EventStreamMessage {
  type: "publish/createDeployment/log";
  data: {
    // structured data not guaranteed, use selective or generic queries
    // from data map
  };
}
export type OnPublishCreateDeploymentLogCallback = (
  msg: PublishCreateDeploymentLog,
) => void;
export function isPublishCreateDeploymentLog(
  arg: Events,
): arg is PublishCreateDeploymentLog {
  return arg.type === "publish/createDeployment/log";
}

export interface PublishCreateDeploymentSuccess extends EventStreamMessage {
  type: "publish/createDeployment/success";
  data: {
    localId: string;
  };
}
export type OnPublishCreateDeploymentSuccessCallback = (
  msg: PublishCreateDeploymentSuccess,
) => void;
export function isPublishCreateDeploymentSuccess(
  arg: Events,
): arg is PublishCreateDeploymentSuccess {
  return arg.type === "publish/createDeployment/success";
}

export interface PublishCreateDeploymentFailure extends EventStreamMessage {
  type: "publish/createDeployment/failure";
  error: string; // translated internally
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishCreateDeploymentFailureCallback = (
  msg: PublishCreateDeploymentFailure,
) => void;
export function isPublishCreateDeploymentFailure(
  arg: Events,
): arg is PublishCreateDeploymentFailure {
  return arg.type === "publish/createDeployment/failure";
}

export interface PublishUploadBundleStart extends EventStreamMessage {
  type: "publish/uploadBundle/start";
  data: {
    localId: string;
  };
}
export type OnPublishUploadBundleStartCallback = (
  msg: PublishUploadBundleStart,
) => void;
export function isPublishUploadBundleStart(
  arg: Events,
): arg is PublishUploadBundleStart {
  return arg.type === "publish/uploadBundle/start";
}

export interface PublishUploadBundleLog extends EventStreamMessage {
  type: "publish/uploadBundle/log";
  data: {
    // structured data not guaranteed, use selective or generic queries
    // from data map
  };
}
export type OnPublishUploadBundleLogCallback = (
  msg: PublishUploadBundleLog,
) => void;
export function isPublishUploadBundleLog(
  arg: Events,
): arg is PublishUploadBundleLog {
  return arg.type === "publish/uploadBundle/log";
}

export interface PublishUploadBundleSuccess extends EventStreamMessage {
  type: "publish/uploadBundle/success";
  data: {
    localId: string;
    bundleId: string;
  };
}
export type OnPublishUploadBundleSuccessCallback = (
  msg: PublishUploadBundleSuccess,
) => void;
export function isPublishUploadBundleSuccess(
  arg: Events,
): arg is PublishUploadBundleSuccess {
  return arg.type === "publish/uploadBundle/success";
}

export interface PublishUploadBundleFailure extends EventStreamMessage {
  type: "publish/uploadBundle/failure";
  error: string; // translated internally
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishUploadBundleFailureCallback = (
  msg: PublishUploadBundleFailure,
) => void;
export function isPublishUploadBundleFailure(
  arg: Events,
): arg is PublishUploadBundleFailure {
  return arg.type === "publish/uploadBundle/failure";
}

export interface PublishDeployBundleStart extends EventStreamMessage {
  type: "publish/deployBundle/start";
  data: {
    localId: string;
  };
}
export type OnPublishDeployBundleStartCallback = (
  msg: PublishDeployBundleStart,
) => void;
export function isPublishDeployBundleStart(
  arg: Events,
): arg is PublishDeployBundleStart {
  return arg.type === "publish/deployBundle/start";
}

export interface PublishDeployBundleLog extends EventStreamMessage {
  type: "publish/deployBundle/log";
  data: {
    // structured data not guaranteed, use selective or generic queries
    // from data map
  };
}
export type OnPublishDeployBundleLogCallback = (
  msg: PublishDeployBundleLog,
) => void;
export function isPublishDeployBundleLog(
  arg: Events,
): arg is PublishDeployBundleLog {
  return arg.type === "publish/deployBundle/log";
}

export interface PublishDeployBundleSuccess extends EventStreamMessage {
  type: "publish/deployBundle/success";
  data: {
    localId: string;
    taskId: string;
  };
}
export type OnPublishDeployBundleSuccessCallback = (
  msg: PublishDeployBundleSuccess,
) => void;
export function isPublishDeployBundleSuccess(
  arg: Events,
): arg is PublishDeployBundleSuccess {
  return arg.type === "publish/deployBundle/success";
}

export interface PublishDeployBundleFailure extends EventStreamMessage {
  type: "publish/deployBundle/failure";
  error: string; // translated internally
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishDeployBundleFailureCallback = (
  msg: PublishDeployBundleFailure,
) => void;
export function isPublishDeployBundleFailure(
  arg: Events,
): arg is PublishDeployBundleFailure {
  return arg.type === "publish/deployBundle/failure";
}

export interface PublishRestorePythonEnvStart extends EventStreamMessage {
  type: "publish/restorePythonEnv/start";
  data: {
    localId: string;
  };
}
export type OnPublishRestorePythonEnvStartCallback = (
  msg: PublishRestorePythonEnvStart,
) => void;
export function isPublishRestorePythonEnvStart(
  arg: Events,
): arg is PublishRestorePythonEnvStart {
  return arg.type === "publish/restorePythonEnv/start";
}

export interface PublishRestorePythonEnvLog extends EventStreamMessage {
  type: "publish/restorePythonEnv/log";
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishRestorePythonEnvLogCallback = (
  msg: PublishRestorePythonEnvLog,
) => void;
export function isPublishRestorePythonEnvLog(
  arg: Events,
): arg is PublishRestorePythonEnvLog {
  return arg.type === "publish/restorePythonEnv/log";
}

export interface PublishRestorePythonEnvProgress extends EventStreamMessage {
  type: "publish/restorePythonEnv/progress";
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishRestorePythonEnvProgressCallback = (
  msg: PublishRestorePythonEnvProgress,
) => void;
export function isPublishRestorePythonEnvProgress(
  arg: Events,
): arg is PublishRestorePythonEnvProgress {
  return arg.type === "publish/restorePythonEnv/progress";
}

type packageRuntime = "r" | "python";
type packageStatus = "download+install" | "download" | "install";

export interface PublishRestorePythonEnvStatus extends EventStreamMessage {
  type: "publish/restorePythonEnv/status";
  data: {
    localId: string;
    name: string;
    runtime: packageRuntime;
    status: packageStatus;
    version: string;
  };
}
export type OnPublishRestorePythonEnvStatusCallback = (
  msg: PublishRestorePythonEnvStatus,
) => void;
export function isPublishRestorePythonEnvStatus(
  arg: Events,
): arg is PublishRestorePythonEnvStatus {
  return arg.type === "publish/restorePythonEnv/status";
}

export interface PublishRestorePythonEnvSuccess extends EventStreamMessage {
  type: "publish/restorePythonEnv/success";
  data: {
    localId: string;
  };
}
export type OnPublishRestorePythonEnvSuccessCallback = (
  msg: PublishRestorePythonEnvSuccess,
) => void;
export function isPublishRestorePythonEnvSuccess(
  arg: Events,
): arg is PublishRestorePythonEnvSuccess {
  return arg.type === "publish/restorePythonEnv/success";
}

export interface PublishRestorePythonEnvFailure extends EventStreamMessage {
  type: "publish/restorePythonEnv/failure";
  error: string; // translated internally
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishRestorePythonEnvFailureCallback = (
  msg: PublishRestorePythonEnvFailure,
) => void;
export function isPublishRestorePythonEnvFailure(
  arg: Events,
): arg is PublishRestorePythonEnvFailure {
  return arg.type === "publish/restorePythonEnv/failure";
}

export interface PublishRestoreREnvStart extends EventStreamMessage {
  type: "publish/restoreREnv/start";
  data: {
    localId: string;
  };
}
export type OnPublishRestoreREnvStartCallback = (
  msg: PublishRestoreREnvStart,
) => void;
export function isPublishRestoreREnvStart(
  arg: Events,
): arg is PublishRestoreREnvStart {
  return arg.type === "publish/restoreREnv/start";
}

export interface PublishRestoreREnvLog extends EventStreamMessage {
  type: "publish/restoreREnv/log";
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishRestoreREnvLogCallback = (
  msg: PublishRestoreREnvLog,
) => void;
export function isPublishRestoreREnvLog(
  arg: Events,
): arg is PublishRestoreREnvLog {
  return arg.type === "publish/restoreREnv/log";
}

export interface PublishRestoreREnvProgress extends EventStreamMessage {
  type: "publish/restoreREnv/progress";
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishRestoreREnvProgressCallback = (
  msg: PublishRestoreREnvProgress,
) => void;
export function isPublishRestoreREnvProgress(
  arg: Events,
): arg is PublishRestoreREnvProgress {
  return arg.type === "publish/restoreREnv/progress";
}

export interface PublishRestoreREnvStatus extends EventStreamMessage {
  type: "publish/restorePythonEnv/status";
  data: {
    localId: string;
    name: string;
    runtime: packageRuntime;
    status: packageStatus;
    version: string;
  };
}
export type OnPublishRestoreREnvStatusCallback = (
  msg: PublishRestoreREnvStatus,
) => void;
export function isPublishRestoreREnvStatus(
  arg: Events,
): arg is PublishRestoreREnvStatus {
  return arg.type === "publish/restoreREnv/status";
}

export interface PublishRestoreREnvSuccess extends EventStreamMessage {
  type: "publish/restoreREnv/success";
  data: {
    localId: string;
  };
}
export type OnPublishRestoreREnvSuccessCallback = (
  msg: PublishRestoreREnvSuccess,
) => void;
export function isPublishRestoreREnvSuccess(
  arg: Events,
): arg is PublishRestoreREnvSuccess {
  return arg.type === "publish/restoreREnv/success";
}

export interface PublishRestoreREnvFailure extends EventStreamMessage {
  type: "publish/restoreREnv/failure";
  error: string; // translated internally
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishRestoreREnvFailureCallback = (
  msg: PublishRestoreREnvFailure,
) => void;
export function isPublishRestoreREnvFailure(
  arg: Events,
): arg is PublishRestoreREnvFailure {
  return arg.type === "publish/restoreREnv/failure";
}

export interface PublishRestoreEnvStart extends EventStreamMessage {
  type: "publish/restoreEnv/start";
  data: {
    localId: string;
  };
}
export type OnPublishRestoreEnvStartCallback = (
  msg: PublishRestoreEnvStart,
) => void;
export function isPublishRestoreEnvStart(
  arg: Events,
): arg is PublishRestoreEnvStart {
  return arg.type === "publish/restoreEnv/start";
}

export interface PublishRestoreEnvLog extends EventStreamMessage {
  type: "publish/restoreEnv/log";
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishRestoreEnvLogCallback = (
  msg: PublishRestoreEnvLog,
) => void;
export function isPublishRestoreEnvLog(
  arg: Events,
): arg is PublishRestoreEnvLog {
  return arg.type === "publish/restoreEnv/log";
}

export interface PublishRestoreEnvProgress extends EventStreamMessage {
  type: "publish/restoreEnv/progress";
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishRestoreEnvProgressCallback = (
  msg: PublishRestoreEnvProgress,
) => void;
export function isPublishRestoreEnvProgress(
  arg: Events,
): arg is PublishRestoreEnvProgress {
  return arg.type === "publish/restoreEnv/progress";
}

export interface PublishRestoreEnvStatus extends EventStreamMessage {
  type: "publish/restorePythonEnv/status";
  data: {
    localId: string;
    name: string;
    runtime: packageRuntime;
    status: packageStatus;
    version: string;
  };
}
export type OnPublishRestoreEnvStatusCallback = (
  msg: PublishRestoreEnvStatus,
) => void;
export function isPublishRestoreEnvStatus(
  arg: Events,
): arg is PublishRestoreEnvStatus {
  return arg.type === "publish/restoreEnv/status";
}

export interface PublishRestoreEnvSuccess extends EventStreamMessage {
  type: "publish/restoreEnv/success";
  data: {
    localId: string;
  };
}
export type OnPublishRestoreEnvSuccessCallback = (
  msg: PublishRestoreEnvSuccess,
) => void;
export function isPublishRestoreEnvSuccess(
  arg: Events,
): arg is PublishRestoreEnvSuccess {
  return arg.type === "publish/restoreEnv/success";
}

export interface PublishRestoreEnvFailure extends EventStreamMessage {
  type: "publish/restoreEnv/failure";
  error: string; // translated internally
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishRestoreEnvFailureCallback = (
  msg: PublishRestoreEnvFailure,
) => void;
export function isPublishRestoreEnvFailure(
  arg: Events,
): arg is PublishRestoreEnvFailure {
  return arg.type === "publish/restoreEnv/failure";
}

export interface PublishRunContentStart extends EventStreamMessage {
  type: "publish/runContent/start";
  data: {
    localId: string;
  };
}
export type OnPublishRunContentStartCallback = (
  msg: PublishRunContentStart,
) => void;
export function isPublishRunContentStart(
  arg: Events,
): arg is PublishRunContentStart {
  return arg.type === "publish/runContent/start";
}

export interface PublishRunContentLog extends EventStreamMessage {
  type: "publish/runContent/log";
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishRunContentLogCallback = (
  msg: PublishRunContentLog,
) => void;
export function isPublishRunContentLog(
  arg: Events,
): arg is PublishRunContentLog {
  return arg.type === "publish/runContent/log";
}

export interface PublishRunContentSuccess extends EventStreamMessage {
  type: "publish/runContent/success";
  data: {
    localId: string;
  };
}
export type OnPublishRunContentSuccessCallback = (
  msg: PublishRunContentSuccess,
) => void;
export function isPublishRunContentSuccess(
  arg: Events,
): arg is PublishRunContentSuccess {
  return arg.type === "publish/runContent/success";
}

export interface PublishRunContentFailure extends EventStreamMessage {
  type: "publish/runContent/failure";
  error: string; // translated internally
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishRunContentFailureCallback = (
  msg: PublishRunContentFailure,
) => void;
export function isPublishRunContentFailure(
  arg: Events,
): arg is PublishRestorePythonEnvFailure {
  return arg.type === "publish/runContent/failure";
}

export interface PublishSetVanityURLStart extends EventStreamMessage {
  type: "publish/setVanityURL/start";
  data: {
    localId: string;
  };
}
export type OnPublishSetVanityURLStartCallback = (
  msg: PublishSetVanityURLStart,
) => void;
export function isPublishSetVanityURLStart(
  arg: Events,
): arg is PublishSetVanityURLStart {
  return arg.type === "publish/setVanityURL/start";
}

export interface PublishSetVanityURLLog extends EventStreamMessage {
  type: "publish/setVanityURL/log";
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishSetVanityURLLogCallback = (
  msg: PublishSetVanityURLLog,
) => void;
export function isPublishSetVanityURLLog(
  arg: Events,
): arg is PublishSetVanityURLLog {
  return arg.type === "publish/setVanityURL/log";
}

export interface PublishSetVanityURLSuccess extends EventStreamMessage {
  type: "publish/setVanityURL/success";
  data: {
    localId: string;
  };
}
export type OnPublishSetVanityURLSuccessCallback = (
  msg: PublishSetVanityURLSuccess,
) => void;
export function isPublishSetVanityURLSuccess(
  arg: Events,
): arg is PublishSetVanityURLSuccess {
  return arg.type === "publish/setVanityURL/success";
}

export interface PublishSetVanityURLFailure extends EventStreamMessage {
  type: "publish/setVanityURL/failure";
  error: string; // translated internally
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishSetVanityURLFailureCallback = (
  msg: PublishSetVanityURLFailure,
) => void;
export function isPublishSetVanityURLFailure(
  arg: Events,
): arg is PublishRestorePythonEnvFailure {
  return arg.type === "publish/setVanityURL/failure";
}
export interface PublishValidateDeploymentStart extends EventStreamMessage {
  type: "publish/validateDeployment/start";
  data: {
    localId: string;
    url: string;
  };
}
export type OnPublishValidateDeploymentStartCallback = (
  msg: PublishValidateDeploymentStart,
) => void;
export function isPublishValidateDeploymentStart(
  arg: Events,
): arg is PublishValidateDeploymentStart {
  return arg.type === "publish/validateDeployment/start";
}

export interface PublishValidateDeploymentLog extends EventStreamMessage {
  type: "publish/validateDeployment/log";
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishValidateDeploymentLogCallback = (
  msg: PublishValidateDeploymentLog,
) => void;
export function isPublishValidateDeploymentLog(
  arg: Events,
): arg is PublishValidateDeploymentLog {
  return arg.type === "publish/validateDeployment/log";
}

export interface PublishValidateDeploymentSuccess extends EventStreamMessage {
  type: "publish/validateDeployment/success";
  data: {
    localId: string;
  };
}
export type OnPublishValidateDeploymentSuccessCallback = (
  msg: PublishValidateDeploymentSuccess,
) => void;
export function isPublisValidateDeploymentSuccess(
  arg: Events,
): arg is PublishValidateDeploymentSuccess {
  return arg.type === "publish/validateDeployment/success";
}

export interface PublishValidateDeploymentFailure extends EventStreamMessage {
  type: "publish/validateDeployment/failure";
  error: string; // translated internally
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishValidateDeploymentFailureCallback = (
  msg: PublishValidateDeploymentFailure,
) => void;
export function isPublishValidateDeploymentFailure(
  arg: Events,
): arg is PublishValidateDeploymentFailure {
  return arg.type === "publish/validateDeployment/failure";
}

export interface PublishSuccess extends EventStreamMessage {
  type: "publish/success";
  data: {
    localId: string;
    contentId: string;
    dashboardUrl: string;
    directUrl: string;
    serverUrl: string;
  };
}
export type OnPublishSuccessCallback = (msg: PublishSuccess) => void;
export function isPublishSuccess(arg: Events): arg is PublishSuccess {
  return arg.type === "publish/success";
}

export interface PublishFailure extends EventStreamMessage {
  type: "publish/failure";
  data: {
    dashboardUrl: string;
    url: string;
    // and other non-defined attributes
  };
  error: string; // translated internally
}

export type OnPublishFailureCallback = (msg: PublishFailure) => void;
export function isPublishFailure(arg: Events): arg is PublishFailure {
  return arg.type === "publish/failure";
}

// Events are a union type of our base and our extended interfaces
export type Events =
  | EventStreamMessage
  | AgentLog
  | ErrorsSse
  | ErrorsOpen
  | ErrorsUnknownEvent
  | OpenSse
  | PublishStart
  | PublishCreateBundleStart
  | PublishCreateBundleLog
  | PublishCreateBundleSuccess
  | PublishCreateBundleFailure
  | PublishCreateDeploymentStart
  | PublishCreateDeploymentSuccess
  | PublishCreateDeploymentFailure
  | PublishUploadBundleStart
  | PublishUploadBundleSuccess
  | PublishUploadBundleFailure
  | PublishDeployBundleStart
  | PublishDeployBundleSuccess
  | PublishDeployBundleFailure
  | PublishRestorePythonEnvStart
  | PublishRestorePythonEnvLog
  | PublishRestorePythonEnvSuccess
  | PublishRestorePythonEnvFailure
  | PublishRunContentStart
  | PublishRunContentLog
  | PublishRunContentSuccess
  | PublishRunContentFailure
  | PublishSuccess
  | PublishFailure;

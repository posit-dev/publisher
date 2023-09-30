// Copyright (C) 2023 by Posit Software, PBC.

export enum EventSourceReadyState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSED = 2,
}

export enum EventStreamMessageType {
  ERROR = 'error',
  LOG = 'log',
}

export type MethodResult = {
  ok: boolean,
  error?: string,
}

export type EventStatus = {
  isOpen?: boolean,
  eventSource: string,
  withCredentials?: boolean,
  readyState?: EventSourceReadyState,
  url: string | null,
  lastError: string | null,
}

export type CallbackQueueEntry = {
  eventType: EventSubscriptionTarget,
  callback: OnMessageEventSourceCallback,
}

// Sample publishing stream of events as of 9/26
// { "time": "2023-09-26T09:23:10.103322-07:00", "type": "open/sse", "data": {} }
// { "time": "2023-09-26T09:23:14.188926-07:00", "type": "agent/log", "data": { "level": "WARN", "message": "Service is operating in DEVELOPMENT MODE with NO browser to server authentication" } }
// { "time": "2023-09-26T09:23:14.189194-07:00", "type": "agent/log", "data": { "level": "INFO", "message": "UI server running", "url": "http://127.0.0.1:9001/" } }
// { "time": "2023-09-26T09:23:20.390417-07:00", "type": "publish/start", "data": { "level": "INFO", "message": "Starting deployment to server", "localId": "O-6_TzmRRBWtd4rm", "server": "https://rsc.radixu.com" } }
// { "time": "2023-09-26T09:23:20.390636-07:00", "type": "publish/createBundle/start", "data": { "level": "INFO", "message": "Creating bundle", "localId": "O-6_TzmRRBWtd4rm" } }
// { "time": "2023-09-26T09:23:20.390671-07:00", "type": "agent/log", "data": { "level": "INFO", "message": "Creating bundle from directory", "localId": "O-6_TzmRRBWtd4rm", "sourceDir": "/Users/billsager/dev/publishing-client/test/sample-content/fastapi-simple" } }
// { "time": "2023-09-26T09:23:20.390944-07:00", "type": "agent/log", "data": { "level": "INFO", "message": "Adding file", "localId": "O-6_TzmRRBWtd4rm", "path": "/Users/billsager/dev/publishing-client/test/sample-content/fastapi-simple/meta.yaml", "size": 63 } }
// { "time": "2023-09-26T09:23:20.392273-07:00", "type": "agent/log", "data": { "level": "INFO", "message": "Adding file", "localId": "O-6_TzmRRBWtd4rm", "path": "/Users/billsager/dev/publishing-client/test/sample-content/fastapi-simple/requirements.in", "size": 124 } }
// { "time": "2023-09-26T09:23:20.392861-07:00", "type": "agent/log", "data": { "level": "INFO", "message": "Adding file", "localId": "O-6_TzmRRBWtd4rm", "path": "/Users/billsager/dev/publishing-client/test/sample-content/fastapi-simple/requirements.txt", "size": 235 } }
// { "time": "2023-09-26T09:23:20.393121-07:00", "type": "agent/log", "data": { "level": "INFO", "message": "Adding file", "localId": "O-6_TzmRRBWtd4rm", "path": "/Users/billsager/dev/publishing-client/test/sample-content/fastapi-simple/simple.py", "size": 369 } }
// { "time": "2023-09-26T09:23:20.39462-07:00", "type": "agent/log", "data": { "level": "INFO", "message": "Bundle created", "files": 4, "localId": "O-6_TzmRRBWtd4rm", "totalBytes": 791 } }
// { "time": "2023-09-26T09:23:20.39491-07:00", "type": "publish/createBundle/success", "data": { "level": "INFO", "message": "Done", "filename": "/var/folders/p8/lrgc44n53k92bbdj58jbnmj40000gn/T/bundle-2901151170.tar.gz", "localId": "O-6_TzmRRBWtd4rm" } }
// { "time": "2023-09-26T09:23:20.394953-07:00", "type": "publish/createDeployment/start", "data": { "level": "INFO", "message": "Creating deployment", "localId": "O-6_TzmRRBWtd4rm" } }
// { "time": "2023-09-26T09:23:21.142721-07:00", "type": "publish/createDeployment/success", "data": { "level": "INFO", "message": "Done", "contentId": "0d976b10-8f98-463c-9647-9738338f53d8", "localId": "O-6_TzmRRBWtd4rm" } }
// { "time": "2023-09-26T09:23:21.142778-07:00", "type": "agent/log", "data": { "!badkey": "0d976b10-8f98-463c-9647-9738338f53d8", "level": "INFO", "message": "content_id", "localId": "O-6_TzmRRBWtd4rm" } }
// { "time": "2023-09-26T09:23:21.142802-07:00", "type": "publish/uploadBundle/start", "data": { "level": "INFO", "message": "Uploading deployment bundle", "localId": "O-6_TzmRRBWtd4rm" } }
// { "time": "2023-09-26T09:23:21.472895-07:00", "type": "publish/uploadBundle/success", "data": { "level": "INFO", "message": "Done", "bundleId": "44523", "localId": "O-6_TzmRRBWtd4rm" } }
// { "time": "2023-09-26T09:23:21.472953-07:00", "type": "publish/deployBundle/start", "data": { "level": "INFO", "message": "Initiating bundle deployment", "localId": "O-6_TzmRRBWtd4rm" } }
// { "time": "2023-09-26T09:23:21.721971-07:00", "type": "publish/deployBundle/success", "data": { "level": "INFO", "message": "Done", "localId": "O-6_TzmRRBWtd4rm", "taskId": "hKKvYQzemoXdNB0f" } }
// { "time": "2023-09-26T09:23:22.312315-07:00", "type": "publish/restorePythonEnv/start", "data": { "level": "INFO", "message": "Building FastAPI application...", "localId": "O-6_TzmRRBWtd4rm", "source": "serverp.log" } }
// { "time": "2023-09-26T09:23:22.312461-07:00", "type": "publish/restorePythonEnv/log", "data": { "level": "INFO", "message": "Bundle created with Python version 3.9.10 is compatible with environment Local with Python version 3.9.7 from /opt/python/3.9.7/bin/python3.9 ", "localId": "O-6_TzmRRBWtd4rm", "source": "serverp.log" } }
// { "time": "2023-09-26T09:23:22.312514-07:00", "type": "publish/restorePythonEnv/log", "data": { "level": "INFO", "message": "Bundle requested Python version 3.9.10; using /opt/python/3.9.7/bin/python3.9 which has version 3.9.7", "localId": "O-6_TzmRRBWtd4rm", "source": "serverp.log" } }
// { "time": "2023-09-26T09:23:22.312563-07:00", "type": "publish/restorePythonEnv/log", "data": { "level": "INFO", "message": "2023/09/26 16:23:21.791559255 [rsc-session] Content GUID: 0d976b10-8f98-463c-9647-9738338f53d8", "localId": "O-6_TzmRRBWtd4rm", "source": "serverp.log" } }
// { "time": "2023-09-26T09:23:22.312877-07:00", "type": "publish/restorePythonEnv/log", "data": { "level": "INFO", "message": "2023/09/26 16:23:21.791600229 [rsc-session] Content ID: 25433", "localId": "O-6_TzmRRBWtd4rm", "source": "serverp.log" } }
// { "time": "2023-09-26T09:23:22.312954-07:00", "type": "publish/restorePythonEnv/log", "data": { "level": "INFO", "message": "2023/09/26 16:23:21.791607274 [rsc-session] Bundle ID: 44523", "localId": "O-6_TzmRRBWtd4rm", "source": "serverp.log" } }
// { "time": "2023-09-26T09:23:22.313001-07:00", "type": "publish/restorePythonEnv/log", "data": { "level": "INFO", "message": "2023/09/26 16:23:21.791611317 [rsc-session] Job Key: aP8OhvuRjXlz50oj", "localId": "O-6_TzmRRBWtd4rm", "source": "serverp.log" } }
// { "time": "2023-09-26T09:23:22.31316-07:00", "type": "publish/restorePythonEnv/log", "data": { "level": "INFO", "message": "2023/09/26 16:23:21.959040190 Running on host: dogfood01", "localId": "O-6_TzmRRBWtd4rm", "source": "serverp.log" } }
// { "time": "2023-09-26T09:23:22.313222-07:00", "type": "publish/restorePythonEnv/log", "data": { "level": "INFO", "message": "2023/09/26 16:23:21.978406756 Linux distribution: Ubuntu 22.04.2 LTS (jammy)", "localId": "O-6_TzmRRBWtd4rm", "source": "serverp.log" } }
// { "time": "2023-09-26T09:23:22.313373-07:00", "type": "publish/restorePythonEnv/log", "data": { "level": "INFO", "message": "2023/09/26 16:23:22.001314693 Running as user: uid=1031(rstudio-connect) gid=999(rstudio-connect) groups=999(rstudio-connect)", "localId": "O-6_TzmRRBWtd4rm", "source": "serverp.log" } }
// { "time": "2023-09-26T09:23:22.313456-07:00", "type": "publish/restorePythonEnv/log", "data": { "level": "INFO", "message": "2023/09/26 16:23:22.001354961 Connect version: 2023.10.0-dev+202-g99a203d308", "localId": "O-6_TzmRRBWtd4rm", "source": "serverp.log" } }
// { "time": "2023-09-26T09:23:22.313597-07:00", "type": "publish/restorePythonEnv/log", "data": { "level": "INFO", "message": "2023/09/26 16:23:22.001775018 LANG: C.UTF-8", "localId": "O-6_TzmRRBWtd4rm", "source": "serverp.log" } }
// { "time": "2023-09-26T09:23:22.313673-07:00", "type": "publish/restorePythonEnv/log", "data": { "level": "INFO", "message": "2023/09/26 16:23:22.001778626 Working directory: /opt/rstudio-connect/mnt/app", "localId": "O-6_TzmRRBWtd4rm", "source": "serverp.log" } }
// { "time": "2023-09-26T09:23:22.313737-07:00", "type": "publish/restorePythonEnv/log", "data": { "level": "INFO", "message": "2023/09/26 16:23:22.001788663 Building environment using Python 3.9.7 (default, Jun 4 2023, 23:06:07) [GCC 11.3.0] at /opt/python/3.9.7/bin/python3.9", "localId": "O-6_TzmRRBWtd4rm", "source": "serverp.log" } }
// { "time": "2023-09-26T09:23:22.313778-07:00", "type": "publish/restorePythonEnv/log", "data": { "level": "INFO", "message": "2023/09/26 16:23:22.050120696 Skipped packages: rsconnect-python==1.17.0", "localId": "O-6_TzmRRBWtd4rm", "source": "serverp.log" } }
// { "time": "2023-09-26T09:23:22.313901-07:00", "type": "publish/restorePythonEnv/log", "data": { "level": "INFO", "message": "2023/09/26 16:23:22.050137035 Using cached environment: Pa5tKYxKMSNr6xGrmbr8Nw", "localId": "O-6_TzmRRBWtd4rm", "source": "serverp.log" } }
// { "time": "2023-09-26T09:23:23.825299-07:00", "type": "publish/restorePythonEnv/log", "data": { "level": "INFO", "message": "2023/09/26 16:23:23.652963987 Packages in the environment: aiofiles==23.2.1, anyio==3.6.2, asgiref==3.6.0, click==8.1.3, fastapi==0.95.2, h11==0.14.0, idna==3.4, pydantic==1.10.7, PyJWT==2.7.0, semver==2.13.0, six==1.16.0, sniffio==1.3.0, starlette==0.27.0, typing_extensions==4.5.0, uvicorn==0.22.0, websockets==11.0.3, ", "localId": "O-6_TzmRRBWtd4rm", "source": "serverp.log" } }
// { "time": "2023-09-26T09:23:23.825459-07:00", "type": "publish/restorePythonEnv/log", "data": { "level": "INFO", "message": "2023/09/26 16:23:23.656037631 Creating lockfile: python/requirements.txt.lock", "localId": "O-6_TzmRRBWtd4rm", "source": "serverp.log" } }
// { "time": "2023-09-26T09:23:25.310946-07:00", "type": "publish/restorePythonEnv/log", "data": { "level": "INFO", "message": "Completed Python build against Python version: '3.9.7'", "localId": "O-6_TzmRRBWtd4rm", "source": "serverp.log" } }
// { "time": "2023-09-26T09:23:25.311036-07:00", "type": "publish/restorePythonEnv/success", "data": { "level": "INFO", "message": "Done", "localId": "O-6_TzmRRBWtd4rm", "source": "serverp.log" } }
// { "time": "2023-09-26T09:23:25.311066-07:00", "type": "publish/runContent/start", "data": { "level": "INFO", "message": "Launching FastAPI application...", "localId": "O-6_TzmRRBWtd4rm", "source": "serverp.log" } }
// { "time": "2023-09-26T09:23:25.311112-07:00", "type": "publish/runContent/success", "data": { "level": "INFO", "message": "Done", "localId": "O-6_TzmRRBWtd4rm", "source": "serverp.log" } }
// { "time": "2023-09-26T09:23:25.311155-07:00", "type": "publish/success", "data": { "level": "INFO", "message": "Deployment successful", "contentId": "0d976b10-8f98-463c-9647-9738338f53d8", "dashboardUrl": "https://rsc.radixu.com/connect/#/apps/0d976b10-8f98-463c-9647-9738338f53d8", "directUrl": "https://rsc.radixu.com/content/0d976b10-8f98-463c-9647-9738338f53d8", "localId": "O-6_TzmRRBWtd4rm", "serverUrl": "https://rsc.radixu.com" } }

export type EventSubscriptionTarget = keyof EventSubscriptionTargetCallbackMap;

export interface EventSubscriptionTargetCallbackMap {
  // all events
  '*': OnMessageEventSourceCallback

  // agent console log messages
  'agent/log': OnAgentLogCallback

  // all errors
  'errors/*': OnMessageEventSourceCallback
  'errors/sse': OnErrorsSseCallback
  'errors/open': OnErrorsOpenCallback
  'errors/unknownEvent': OnErrorsUnknownEventCallback

  // open events
  'open/*': OnMessageEventSourceCallback
  'open/sse': OnOpenSseCallback

  // publish events
  'publish/*': OnMessageEventSourceCallback
  'publish/**/log': OnMessageEventSourceCallback
  'publish/**/failure': OnMessageEventSourceCallback
  'publish/start': OnPublishStartCallback

  'publish/createBundle/start': OnPublishCreateBundleStartCallback
  'publish/createBundle/log': OnPublishCreateBundleLogCallback
  'publish/createBundle/success': OnPublishCreateBundleSuccessCallback
  'publish/createBundle/failure': OnPublishCreateBundleFailureCallback

  // 'publish/createBundle/failure/authFailure' | // received but temporarily converted
  'publish/createDeployment/start': OnPublishCreateDeploymentStartCallback
  'publish/createDeployment/success': OnPublishCreateDeploymentSuccessCallback
  'publish/createDeployment/failure': OnPublishCreateDeploymentFailureCallback

  'publish/uploadBundle/start': OnPublishUploadBundleStartCallback
  'publish/uploadBundle/success': OnPublishUploadBundleSuccessCallback
  'publish/uploadBundle/failure': OnPublishUploadBundleFailureCallback

  'publish/deployBundle/start': OnPublishDeployBundleStartCallback
  'publish/deployBundle/success': OnPublishDeployBundleSuccessCallback
  'publish/deployBundle/failure': OnPublishDeployBundleFailureCallback

  // 'publish/restore' | // found during agent code searches but not received
  // 'publish/restore/log' | // found during agent code searches but not received

  'publish/restorePythonEnv/start': OnPublishRestorePythonEnvStartCallback
  'publish/restorePythonEnv/log': OnPublishRestorePythonEnvLogCallback
  'publish/restorePythonEnv/success': OnPublishRestorePythonEnvSuccessCallback
  'publish/restorePythonEnv/failure': OnPublishRestorePythonEnvFailureCallback
  // 'publish/restorePythonEnv/failure/serverErr' | // received but temporarily converted

  'publish/runContent/start': OnPublishRunContentStartCallback
  'publish/runContent/log': OnPublishRunContentLogCallback
  'publish/runContent/success': OnPublishRunContentSuccessCallback
  'publish/runContent/failure': OnPublishRunContentFailureCallback

  // 'publish/setVanityURL' | // new, but on hold

  'publish/success': OnPublishSuccessCallback
  'publish/failure': OnPublishFailureCallback
}

export function getLocalId(arg: EventStreamMessage) {
  return arg.data.localId;
}

interface StringMapOfStrings {
  [key: string]: string,
}

export interface EventStreamMessage {
  type: EventSubscriptionTarget,
  time: string,
  data: StringMapOfStrings,
  error?: string,
}

export type OnMessageEventSourceCallback = <T extends EventStreamMessage>(msg: T) => void;

export function isEventStreamMessage(o: object): o is EventStreamMessage {
  return (
    'type' in o && typeof o.type === 'string' &&
    'time' in o && typeof o.time === 'string' &&
    'data' in o && typeof o.data === 'object'
  );
}

// define interfaces which specialize an EventStreamMessage
// and provide type guards for them to support proper typing.

export interface AgentLog extends EventStreamMessage {
  type: 'agent/log',
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnAgentLogCallback = (msg: AgentLog) => void;
export function isAgentLog(arg: Events):
  arg is AgentLog {
  return arg.type === 'agent/log';
}

export interface ErrorsSse extends EventStreamMessage {
  type: 'errors/sse',
}
export type OnErrorsSseCallback = (msg: ErrorsSse) => void;
export function isErrorsSse(arg: Events):
  arg is ErrorsSse {
  return arg.type === 'errors/sse';
}

export interface ErrorsOpen extends EventStreamMessage {
  type: 'errors/open',
}
export type OnErrorsOpenCallback = (msg: ErrorsOpen) => void;
export function isErrorsOpen(arg: Events):
  arg is ErrorsOpen {
  return arg.type === 'errors/open';
}

export interface ErrorsUnknownEvent extends EventStreamMessage {
  type: 'errors/unknownEvent',
}
export type OnErrorsUnknownEventCallback = (msg: ErrorsUnknownEvent) => void;
export function isErrorsUnknownEvent(arg: Events):
  arg is ErrorsUnknownEvent {
  return arg.type === 'errors/unknownEvent';
}

export interface OpenSse extends EventStreamMessage {
  type: 'open/sse',
}
export type OnOpenSseCallback = (msg: OpenSse) => void;
export function isOpenSse(arg: Events):
  arg is OpenSse {
  return arg.type === 'open/sse';
}

export interface PublishStart extends EventStreamMessage {
  type: 'publish/start',
  data: {
    // "level": "INFO", "message": "Starting deployment to server", "localId": "O-6_TzmRRBWtd4rm", "server": "https://rsc.radixu.com"
    level: string,
    message: string,
    localId: string,
    server: string,
  }
}
export type OnPublishStartCallback = (msg: PublishStart) => void;
export function isPublishStart(arg: Events):
  arg is PublishStart {
  return arg.type === 'publish/start';
}

export interface PublishCreateBundleStart extends EventStreamMessage {
  type: 'publish/createBundle/start',
  data: {
    // "level": "INFO", "message": "Creating bundle", "localId": "O-6_TzmRRBWtd4rm"
    level: string,
    message: string,
    localId: string,
  }
}
export type OnPublishCreateBundleStartCallback = (msg: PublishCreateBundleStart) => void;
export function isPublishCreateBundleStart(arg: Events):
  arg is PublishCreateBundleStart {
  return arg.type === 'publish/createBundle/start';
}

export interface PublishCreateBundleLog extends EventStreamMessage {
  type: 'publish/createBundle/log',
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishCreateBundleLogCallback = (msg: PublishCreateBundleLog) => void;
export function isPublishCreateBundleLog(arg: Events):
  arg is PublishCreateBundleLog {
  return arg.type === 'publish/createBundle/log';
}

export interface PublishCreateBundleSuccess extends EventStreamMessage {
  type: 'publish/createBundle/success',
  data: {
    // "level": "INFO", "message": "Done", "filename": "/var/folders/p8/lrgc44n53k92bbdj58jbnmj40000gn/T/bundle-2901151170.tar.gz", "localId": "O-6_TzmRRBWtd4rm"
    level: string,
    message: string,
    filename: string,
    localId: string,
  }
}
export type OnPublishCreateBundleSuccessCallback = (msg: PublishCreateBundleSuccess) => void;
export function isPublishCreateBundleSuccess(arg: Events):
  arg is PublishCreateBundleSuccess {
  return arg.type === 'publish/createBundle/success';
}

export interface PublishCreateBundleFailure extends EventStreamMessage {
  type: 'publish/createBundle/failure',
  error: string, // translated internally
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishCreateBundleFailureCallback = (msg: PublishCreateBundleFailure) => void;
export function isPublishCreateBundleFailure(arg: Events):
  arg is PublishCreateBundleFailure {
  return arg.type === 'publish/createBundle/failure';
}

export interface PublishCreateDeploymentStart extends EventStreamMessage {
  type: 'publish/createDeployment/start',
  data: {
    // "level": "INFO", "message": "Creating deployment", "localId": "O-6_TzmRRBWtd4rm"
    level: string,
    message: string,
    localId: string,
  }
}
export type OnPublishCreateDeploymentStartCallback = (msg: PublishCreateDeploymentStart) => void;
export function isPublishCreateDeploymentStart(arg: Events):
  arg is PublishCreateDeploymentStart {
  return arg.type === 'publish/createDeployment/start';
}

export interface PublishCreateDeploymentSuccess extends EventStreamMessage {
  type: 'publish/createDeployment/success',
  data: {
    // "level": "INFO", "message": "Done", "contentId": "0d976b10-8f98-463c-9647-9738338f53d8", "localId": "O-6_TzmRRBWtd4rm"
    level: string,
    message: string,
    contentId: string,
    localId: string,
  }
}
export type OnPublishCreateDeploymentSuccessCallback =
  (msg: PublishCreateDeploymentSuccess) => void;
export function isPublishCreateDeploymentSuccess(arg: Events):
  arg is PublishCreateDeploymentSuccess {
  return arg.type === 'publish/createDeployment/success';
}

export interface PublishCreateDeploymentFailure extends EventStreamMessage {
  type: 'publish/createDeployment/failure',
  error: string, // translated internally
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishCreateDeploymentFailureCallback =
  (msg: PublishCreateDeploymentFailure) => void;
export function isPublishCreateDeploymentFailure(arg: Events):
  arg is PublishCreateDeploymentFailure {
  return arg.type === 'publish/createDeployment/failure';
}

export interface PublishUploadBundleStart extends EventStreamMessage {
  type: 'publish/uploadBundle/start',
  data: {
    // "level": "INFO", "message": "Uploading deployment bundle", "localId": "O-6_TzmRRBWtd4rm"
    level: string,
    message: string,
    localId: string,
  }
}
export type OnPublishUploadBundleStartCallback = (msg: PublishUploadBundleStart) => void;
export function isPublishUploadBundleStart(arg: Events):
  arg is PublishUploadBundleStart {
  return arg.type === 'publish/uploadBundle/start';
}

export interface PublishUploadBundleSuccess extends EventStreamMessage {
  type: 'publish/uploadBundle/success',
  data: {
    // "level": "INFO", "message": "Done", "bundleId": "44523", "localId": "O-6_TzmRRBWtd4rm"
    level: string,
    message: string,
    bundleId: string,
    localId: string,
  }
}
export type OnPublishUploadBundleSuccessCallback = (msg: PublishUploadBundleSuccess) => void;
export function isPublishUploadBundleSuccess(arg: Events):
  arg is PublishUploadBundleSuccess {
  return arg.type === 'publish/uploadBundle/success';
}

export interface PublishUploadBundleFailure extends EventStreamMessage {
  type: 'publish/uploadBundle/failure',
  error: string, // translated internally
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishUploadBundleFailureCallback = (msg: PublishUploadBundleFailure) => void;
export function isPublishUploadBundleFailure(arg: Events):
  arg is PublishUploadBundleFailure {
  return arg.type === 'publish/uploadBundle/failure';
}

export interface PublishDeployBundleStart extends EventStreamMessage {
  type: 'publish/deployBundle/start',
  data: {
    // "level": "INFO", "message": "Uploading deployment bundle", "localId": "O-6_TzmRRBWtd4rm"
    level: string,
    message: string,
    localId: string,
  }
}
export type OnPublishDeployBundleStartCallback = (msg: PublishDeployBundleStart) => void;
export function isPublishDeployBundleStart(arg: Events):
  arg is PublishDeployBundleStart {
  return arg.type === 'publish/deployBundle/start';
}

export interface PublishDeployBundleSuccess extends EventStreamMessage {
  type: 'publish/deployBundle/success',
  data: {
    // "level": "INFO", "message": "Done", "localId": "O-6_TzmRRBWtd4rm", "taskId": "hKKvYQzemoXdNB0f"
    level: string,
    message: string,
    localId: string,
    taskId: string,
  }
}
export type OnPublishDeployBundleSuccessCallback = (msg: PublishDeployBundleSuccess) => void;
export function isPublishDeployBundleSuccess(arg: Events):
  arg is PublishDeployBundleSuccess {
  return arg.type === 'publish/deployBundle/success';
}

export interface PublishDeployBundleFailure extends EventStreamMessage {
  type: 'publish/deployBundle/failure',
  error: string, // translated internally
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishDeployBundleFailureCallback = (msg: PublishDeployBundleFailure) => void;
export function isPublishDeployBundleFailure(arg: Events):
  arg is PublishDeployBundleFailure {
  return arg.type === 'publish/deployBundle/failure';
}

export interface PublishRestorePythonEnvStart extends EventStreamMessage {
  type: 'publish/restorePythonEnv/start',
  data: {
    // "level": "INFO", "message": "Building FastAPI application...", "localId": "O-6_TzmRRBWtd4rm", "source": "serverp.log"
    level: string,
    message: string,
    localId: string,
    source: string,
  }
}
export type OnPublishRestorePythonEnvStartCallback = (msg: PublishRestorePythonEnvStart) => void;
export function isPublishRestorePythonEnvStart(arg: Events):
  arg is PublishRestorePythonEnvStart {
  return arg.type === 'publish/restorePythonEnv/start';
}

export interface PublishRestorePythonEnvLog extends EventStreamMessage {
  type: 'publish/restorePythonEnv/log',
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishRestorePythonEnvLogCallback = (msg: PublishRestorePythonEnvLog) => void;
export function isPublishRestorePythonEnvLog(arg: Events):
  arg is PublishRestorePythonEnvLog {
  return arg.type === 'publish/restorePythonEnv/log';
}

export interface PublishRestorePythonEnvSuccess extends EventStreamMessage {
  type: 'publish/restorePythonEnv/success',
  data: {
    // "level": "INFO", "message": "Done", "localId": "O-6_TzmRRBWtd4rm", "source": "serverp.log"
    level: string,
    message: string,
    localId: string,
    source: string,
  }
}
export type OnPublishRestorePythonEnvSuccessCallback =
  (msg: PublishRestorePythonEnvSuccess) => void;
export function isPublishRestorePythonEnvSuccess(arg: Events):
  arg is PublishRestorePythonEnvSuccess {
  return arg.type === 'publish/restorePythonEnv/success';
}

export interface PublishRestorePythonEnvFailure extends EventStreamMessage {
  type: 'publish/restorePythonEnv/failure',
  error: string, // translated internally
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishRestorePythonEnvFailureCallback =
  (msg: PublishRestorePythonEnvFailure) => void;
export function isPublishRestorePythonEnvFailure(arg: Events):
  arg is PublishRestorePythonEnvFailure {
  return arg.type === 'publish/restorePythonEnv/failure';
}

export interface PublishRunContentStart extends EventStreamMessage {
  type: 'publish/runContent/start',
  data: {
    // "level": "INFO", "message": "Launching FastAPI application...", "localId": "O-6_TzmRRBWtd4rm", "source": "serverp.log"
    level: string,
    message: string,
    localId: string,
    source: string,
  }
}
export type OnPublishRunContentStartCallback = (msg: PublishRunContentStart) => void;
export function isPublishRunContentStart(arg: Events):
  arg is PublishRunContentStart {
  return arg.type === 'publish/runContent/start';
}

export interface PublishRunContentLog extends EventStreamMessage {
  type: 'publish/runContent/log',
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishRunContentLogCallback = (msg: PublishRunContentLog) => void;
export function isPublishRunContentLog(arg: Events):
  arg is PublishRunContentLog {
  return arg.type === 'publish/runContent/log';
}

export interface PublishRunContentSuccess extends EventStreamMessage {
  type: 'publish/runContent/success',
  data: {
    // "level": "INFO", "message": "Done", "localId": "O-6_TzmRRBWtd4rm", "source": "serverp.log"
    level: string,
    message: string,
    localId: string,
    source: string,
  }
}
export type OnPublishRunContentSuccessCallback = (msg: PublishRunContentSuccess) => void;
export function isPublishRunContentSuccess(arg: Events):
  arg is PublishRunContentSuccess {
  return arg.type === 'publish/runContent/success';
}

export interface PublishRunContentFailure extends EventStreamMessage {
  type: 'publish/runContent/failure',
  error: string, // translated internally
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishRunContentFailureCallback = (msg: PublishRunContentFailure) => void;
export function isPublishRunContentFailure(arg: Events):
  arg is PublishRestorePythonEnvFailure {
  return arg.type === 'publish/runContent/failure';
}

export interface PublishSuccess extends EventStreamMessage {
  type: 'publish/success',
  data: {
    // "level": "INFO", "message": "Deployment successful", "contentId": "0d976b10-8f98-463c-9647-9738338f53d8", "dashboardUrl": "https://rsc.radixu.com/connect/#/apps/0d976b10-8f98-463c-9647-9738338f53d8", "directUrl": "https://rsc.radixu.com/content/0d976b10-8f98-463c-9647-9738338f53d8", "localId": "O-6_TzmRRBWtd4rm", "serverUrl": "https://rsc.radixu.com"
    level: string,
    message: string,
    contentId: string,
    datashboardUrl: string,
    directUrl: string,
    localId: string,
    serverUrl: string,
  }
}
export type OnPublishSuccessCallback = (msg: PublishSuccess) => void;
export function isPublishSuccess(arg: Events): arg is PublishSuccess {
  return arg.type === 'publish/success';
}

export interface PublishFailure extends EventStreamMessage {
  type: 'publish/failure',
  error: string, // translated internally
  // structured data not guaranteed, use selective or generic queries
  // from data map
}
export type OnPublishFailureCallback = (msg: PublishFailure) => void;
export function isPublishFailure(arg: Events):
  arg is PublishFailure {
  return arg.type === 'publish/failure';
}

// Events are a union type of our base and our extended interfaces
export type Events =
  EventStreamMessage |
  AgentLog |
  ErrorsSse |
  ErrorsOpen |
  ErrorsUnknownEvent |
  OpenSse |
  PublishStart |
  PublishCreateBundleStart |
  PublishCreateBundleLog |
  PublishCreateBundleSuccess |
  PublishCreateBundleFailure |
  PublishCreateDeploymentStart |
  PublishCreateDeploymentSuccess |
  PublishCreateDeploymentFailure |
  PublishUploadBundleStart |
  PublishUploadBundleSuccess |
  PublishUploadBundleFailure |
  PublishDeployBundleStart |
  PublishDeployBundleSuccess |
  PublishDeployBundleFailure |
  PublishRestorePythonEnvStart |
  PublishRestorePythonEnvLog |
  PublishRestorePythonEnvSuccess |
  PublishRestorePythonEnvFailure |
  PublishRunContentStart |
  PublishRunContentLog |
  PublishRunContentSuccess |
  PublishRunContentFailure |
  PublishSuccess |
  PublishFailure;

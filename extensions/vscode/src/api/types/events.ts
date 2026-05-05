// Copyright (C) 2023 by Posit Software, PBC.

import { ErrorCode } from "../../utils/errorTypes";
import { ProductType } from "./contentRecords";

// ---------------------------------------------------------------------------
// Core event types
// ---------------------------------------------------------------------------

export interface EventStreamMessage<T = Record<string, string>> {
  type: string;
  time: string;
  data: T;
  errCode?: ErrorCode;
  error?: string;
}

// Events is the union type accepted by event type guards.
export type Events =
  | EventStreamMessage
  | PublishSuccess
  | PublishFailure
  | PublishRestorePythonEnvStatus
  | PublishRestoreREnvStatus
  | PublishRestoreEnvStatus;

// EventSubscriptionTarget represents the SSE event type string.
export type EventSubscriptionTarget = string;

// ---------------------------------------------------------------------------
// Publish success / failure
// ---------------------------------------------------------------------------

interface PublishSuccessData {
  localId: string;
  contentId: string;
  dashboardUrl: string;
  directUrl: string;
  serverUrl: string;
  productType: ProductType;
  [key: string]: string;
}

export interface PublishSuccess extends EventStreamMessage<PublishSuccessData> {
  type: "publish/success";
}

export function isPublishSuccess(arg: Events): arg is PublishSuccess {
  return arg.type === "publish/success";
}

interface PublishFailureData {
  dashboardUrl: string;
  url: string;
  productType: ProductType;
  canceled: string;
  [key: string]: string;
}

export interface PublishFailure extends EventStreamMessage<PublishFailureData> {
  type: "publish/failure";
  error: string;
}

export function isPublishFailure(arg: Events): arg is PublishFailure {
  return arg.type === "publish/failure";
}

// ---------------------------------------------------------------------------
// Restore environment status events (used by eventMsgToString)
// ---------------------------------------------------------------------------

type packageRuntime = "r" | "python";
type packageStatus = "download+install" | "download" | "install";

interface RestoreEnvStatusData {
  localId: string;
  name: string;
  runtime: packageRuntime;
  status: packageStatus;
  version: string;
  [key: string]: string;
}

export interface PublishRestorePythonEnvStatus extends EventStreamMessage<RestoreEnvStatusData> {
  type: "publish/restorePythonEnv/status";
}

function isPublishRestorePythonEnvStatus(
  arg: Events,
): arg is PublishRestorePythonEnvStatus {
  return arg.type === "publish/restorePythonEnv/status";
}

export interface PublishRestoreREnvStatus extends EventStreamMessage<RestoreEnvStatusData> {
  type: "publish/restoreREnv/status";
}

function isPublishRestoreREnvStatus(
  arg: Events,
): arg is PublishRestoreREnvStatus {
  return arg.type === "publish/restoreREnv/status";
}

export interface PublishRestoreEnvStatus extends EventStreamMessage<RestoreEnvStatusData> {
  type: "publish/restoreEnv/status";
}

export function isPublishRestoreEnvStatus(
  arg: Events,
): arg is PublishRestoreEnvStatus {
  return arg.type === "publish/restoreEnv/status";
}

// ---------------------------------------------------------------------------
// Event display helpers
// ---------------------------------------------------------------------------

export const restoreMsgToStatusSuffix = (
  msg:
    | PublishRestorePythonEnvStatus
    | PublishRestoreREnvStatus
    | PublishRestoreEnvStatus,
) => {
  let suffix = msg.data.name;
  if (msg.data.version) {
    suffix = `${suffix} (${msg.data.version})...`;
  } else {
    suffix = `${suffix}...`;
  }
  return suffix;
};

type activeInactivePhrases = {
  inActive: string;
  active: string;
};

const eventVerbToString = new Map<string, activeInactivePhrases>([
  [
    "publish/checkCapabilities",
    {
      active: "Checking Capabilities",
      inActive: "Check Capabilities",
    },
  ],
  [
    "publish/createNewDeployment",
    {
      active: "Creating New Deployment",
      inActive: "Create New Deployment",
    },
  ],
  [
    "publish/createBundle",
    {
      inActive: "Create Bundle",
      active: "Creating Bundle",
    },
  ],
  [
    "publish/updateContent",
    {
      inActive: "Update Content",
      active: "Updating Content",
    },
  ],
  [
    "publish/uploadBundle",
    {
      inActive: "Upload Bundle",
      active: "Uploading Bundle",
    },
  ],
  [
    "publish/createDeployment",
    {
      inActive: "Create Deployment",
      active: "Creating Deployment",
    },
  ],
  [
    "publish/deployContent",
    {
      inActive: "Deploy Content",
      active: "Deploying Content",
    },
  ],
  [
    "publish/deployBundle",
    {
      inActive: "Deploy Bundle",
      active: "Deploying Bundle",
    },
  ],
  [
    "publish/restorePythonEnv",
    {
      inActive: "Restore Python Environment",
      active: "Restoring Python Environment",
    },
  ],
  [
    "publish/restoreREnv",
    {
      inActive: "Restore R Environment",
      active: "Restoring R Environment",
    },
  ],
  [
    "publish/restoreEnv",
    {
      inActive: "Restore Environment",
      active: "Restoring Environment",
    },
  ],
  [
    "publish/runContent",
    {
      inActive: "Run Content",
      active: "Running Content",
    },
  ],
  [
    "publish/setVanityURL",
    {
      inActive: "Set Vanity URL",
      active: "Setting Vanity URL",
    },
  ],
  [
    "publish/setEnvVars",
    {
      inActive: "Set Environment Variables",
      active: "Set Environment Variables",
    },
  ],
  [
    "publish/validateDeployment",
    {
      inActive: "Validate Deployment",
      active: "Validating Deployment",
    },
  ],
  [
    "publish/success",
    {
      inActive: "Wrapped up Deployment",
      active: "Wrapping up Deployment",
    },
  ],
]);

const eventTypeToString = (eventTypeStr: string): string => {
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
  const base = eventVerbToString.get(verb);

  // we don't know about this event
  if (base === undefined) {
    return eventTypeStr;
  }

  if (parts[2] === "success" || parts[2] === "failure") {
    return base.inActive;
  }
  return base.active;
};

export const eventMsgToString = (msg: EventStreamMessage): string => {
  let suffix: string | undefined;
  if (
    isPublishRestorePythonEnvStatus(msg) ||
    isPublishRestoreREnvStatus(msg) ||
    isPublishRestoreEnvStatus(msg)
  ) {
    suffix = restoreMsgToStatusSuffix(msg);
  }

  if (suffix) {
    return `${eventTypeToString(msg.type)} - ${suffix}`;
  }
  return eventTypeToString(msg.type);
};

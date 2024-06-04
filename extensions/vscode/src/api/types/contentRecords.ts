// Copyright (C) 2023 by Posit Software, PBC.

import { AgentError } from "./error";
import { Configuration, ConfigurationLocation } from "./configurations";
import { SchemaURL } from "./schema";
import { ServerType } from "./accounts";

export enum ContentRecordState {
  NEW = "new",
  DEPLOYED = "deployed",
  ERROR = "error",
}

export type ContentRecordLocation = {
  contentRecordName: string;
  contentRecordPath: string;
};

export type ContentRecordError = {
  error: AgentError;
  state: ContentRecordState.ERROR;
} & ContentRecordLocation;

type ContentRecordRecord = {
  $schema: SchemaURL;
  serverType: ServerType;
  serverUrl: string;
  saveName: string;
  createdAt: string;
  configurationName: string;
  contentRecordError: AgentError | null;
} & ContentRecordLocation;

export type PreContentRecord = {
  state: ContentRecordState.NEW;
} & ContentRecordRecord;

export type PreContentRecordWithConfig = PreContentRecord &
  ConfigurationLocation;

export type ContentRecord = {
  id: string;
  bundleId: string;
  bundleUrl: string;
  dashboardUrl: string;
  directUrl: string;
  files: string[];
  deployedAt: string;
  state: ContentRecordState.DEPLOYED;
} & ContentRecordRecord &
  Configuration;

export type AllContentRecordTypes =
  | ContentRecord
  | PreContentRecord
  | PreContentRecordWithConfig
  | ContentRecordError;

export function isSuccessful(
  d: AllContentRecordTypes | undefined,
): boolean | undefined {
  if (d === undefined) {
    return undefined;
  }
  if (isContentRecordError(d)) {
    return false;
  }
  return Boolean(!d.contentRecordError);
}

export function isUnsuccessful(
  d: AllContentRecordTypes | undefined,
): boolean | undefined {
  const result = isSuccessful(d);
  if (result === undefined) {
    return undefined;
  }
  return !result;
}

export function isContentRecordError(
  d: AllContentRecordTypes | undefined,
): d is ContentRecordError {
  return Boolean(d && d.state === ContentRecordState.ERROR);
}

export function isPreContentRecord(
  d: AllContentRecordTypes | undefined,
): d is PreContentRecord {
  return Boolean(d && d.state === ContentRecordState.NEW);
}

export function isPreContentRecordWithConfig(
  d: AllContentRecordTypes | undefined,
): d is PreContentRecordWithConfig {
  return Boolean(
    d &&
      d.state === ContentRecordState.NEW &&
      (d as PreContentRecordWithConfig).configurationName !== undefined,
  );
}

export function isSuccessfulPreContentRecord(
  d: AllContentRecordTypes | undefined,
): d is PreContentRecord {
  if (isPreContentRecord(d)) {
    const success = isSuccessful(d);
    if (success !== undefined) {
      return success;
    }
  }
  return false;
}

export function isUnsuccessfulPreContentRecord(
  d: AllContentRecordTypes | undefined,
): d is PreContentRecord {
  if (isPreContentRecord(d)) {
    const failure = isUnsuccessful(d);
    if (failure !== undefined) {
      return failure;
    }
  }
  return false;
}

export function isContentRecord(
  d: AllContentRecordTypes | undefined,
): d is ContentRecord {
  return Boolean(d && d.state === ContentRecordState.DEPLOYED);
}

export function isSuccessfulContentRecord(
  d: AllContentRecordTypes | undefined,
): d is ContentRecord {
  if (isContentRecord(d)) {
    const success = isSuccessful(d);
    if (success !== undefined) {
      return success;
    }
  }
  return false;
}

export function isUnsuccessfulContentRecord(
  d: AllContentRecordTypes | undefined,
): d is ContentRecord {
  if (isContentRecord(d)) {
    const failure = isUnsuccessful(d);
    if (failure !== undefined) {
      return failure;
    }
  }
  return false;
}

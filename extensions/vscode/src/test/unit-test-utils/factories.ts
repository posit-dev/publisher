// Copyright (C) 2024 by Posit Software, PBC.

import { Factory } from "fishery";
import {
  PreContentRecord,
  ContentRecord,
  ServerType,
  ContentRecordState,
} from "src/api/types/contentRecords";
import { ContentType, Configuration } from "src/api/types/configurations";
import { Credential } from "src/api/types/credentials";
import { DeploymentSelectorState } from "src/types/shared";

export const selectionStateFactory = Factory.define<DeploymentSelectorState>(
  ({ sequence }) => ({
    version: "v1",
    projectDir: `report-GUD${sequence}`,
    deploymentName: `report ${sequence}`,
    deploymentPath: `report/path/${sequence}`,
  }),
);

export const configurationFactory = Factory.define<Configuration>(
  ({ sequence }) => ({
    configuration: {
      $schema: "test-schema-url",
      type: ContentType.RMD,
      validate: true,
      configurationName: "",
      projectDir: "",
    },
    projectDir: `report-GUD${sequence}`,
    configurationName: `configuration-GUD${sequence}`,
    configurationPath: `report/path/configuration-${sequence}`,
    configurationRelPath: `report/path/configuration-${sequence}`,
  }),
);

export const preContentRecordFactory = Factory.define<PreContentRecord>(
  ({ sequence }) => ({
    $schema: "test-schema-url",
    serverType: ServerType.CONNECT,
    serverUrl: `https://connect-test-${sequence}/connect`,
    saveName: `Report ${sequence}`,
    createdAt: new Date().toISOString(),
    dismissedAt: "",
    configurationName: `report-GUD${sequence}`,
    type: ContentType.RMD,
    deploymentError: null,
    state: ContentRecordState.NEW,
    projectDir: `report-GUD${sequence}`,
    deploymentName: `report ${sequence}`,
    deploymentPath: `report/path/${sequence}`,
  }),
);

export const contentRecordFactory = Factory.define<ContentRecord>(
  ({ sequence }) => ({
    $schema: "test-schema-url",
    id: `GUD${sequence}`,
    bundleId: `XYZ${sequence}`,
    bundleUrl: `XYZ${sequence}`,
    dashboardUrl: `https://connect-test-${sequence}/connect`,
    directUrl: `https://connect-test-${sequence}/content/XYZ${sequence}`,
    logsUrl: `https://connect-test-${sequence}/connect/#/apps/XYZ${sequence}/output`,
    files: [],
    serverType: ServerType.CONNECT,
    serverUrl: `https://connect-test-${sequence}/connect`,
    saveName: `Report ${sequence}`,
    createdAt: new Date().toISOString(),
    dismissedAt: "",
    deployedAt: new Date().toISOString(),
    configurationName: `report-GUD${sequence}`,
    type: ContentType.RMD,
    deploymentError: null,
    state: ContentRecordState.DEPLOYED,
    projectDir: `report-GUD${sequence}`,
    deploymentName: `report ${sequence}`,
    deploymentPath: `report/path/${sequence}`,
    configuration: {
      $schema: "test-schema-url",
      type: ContentType.RMD,
      validate: true,
      configurationName: "",
      projectDir: "",
    },
    configurationPath: `report/path/configuration-${sequence}`,
    configurationRelPath: `report/path/configuration-${sequence}`,
  }),
);

export const credentialFactory = Factory.define<Credential>(({ sequence }) => ({
  guid: `44a468b8-09c7-4c6d-a7a3-8cf164ddbaf${sequence}`,
  name: `Credential ${sequence}`,
  url: `https://connect.${sequence}.site.com/connect`,
  apiKey: `qwerty-${sequence}`,
}));

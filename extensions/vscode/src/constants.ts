// Copyright (C) 2025 by Posit Software, PBC.

import config from "./config";

export const POSIT_FOLDER = "**/.posit";
export const PUBLISH_FOLDER = "**/.posit/publish";
export const PUBLISH_DEPLOYMENTS_FOLDER = "**/.posit/publish/deployments";

export const CONFIGURATIONS_PATTERN = "**/.posit/publish/*.toml";
export const DEPLOYMENTS_PATTERN = "**/.posit/publish/deployments/*.toml";

export const DEFAULT_PYTHON_PACKAGE_FILE = "requirements.txt";
export const DEFAULT_R_PACKAGE_FILE = "renv.lock";

// pulled from /internal/services/api/get_entrypoints.go
// should all be lowercase!
export const ENTRYPOINT_FILE_EXTENSIONS = [
  ".htm",
  ".html",
  ".ipynb",
  ".py",
  ".qmd",
  ".r",
  ".rmd",
];

export enum BooleanContextValues {
  True = "true",
  False = "false",
}

const baseCommands = {
  InitProject: "posit.publisher.init-project",
  ShowOutputChannel: "posit.publisher.showOutputChannel",
  ShowPublishingLog: "posit.publisher.showPublishingLog",
  DeployWithEntrypoint: "posit.publisher.deployWithEntrypoint",
} as const;

const baseContexts = {
  ActiveFileEntrypoint: "posit.publish.activeFileEntrypoint",
} as const;

const logsCommands = {
  Visit: "posit.publisher.logs.visit",
  // Added automatically by VSCode with view registration
  Fileview: "posit.publisher.logs.fileview",
  Copy: "posit.publisher.logs.copy",
  Focus: "posit.publisher.logs.focus",
  ToggleVisibility: "posit.publisher.logs.toggleVisibility",
} as const;

const credentialsContexts = {
  Keychain: "posit.publisher.credentials.tree.item.keychain",
  EnvironmentVars: "posit.publisher.credentials.tree.item.environmentVars",
};

const filesCommands = {
  Refresh: "posit.publisher.files.refresh",
  Exclude: "posit.publisher.files.exclude",
  Include: "posit.publisher.files.include",
} as const;

const pythonPackagesCommands = {
  Edit: "posit.publisher.pythonPackages.edit",
  Refresh: "posit.publisher.pythonPackages.refresh",
  Scan: "posit.publisher.pythonPackages.scan",
} as const;

const rPackagesCommands = {
  Edit: "posit.publisher.rPackages.edit",
  Refresh: "posit.publisher.rPackages.refresh",
} as const;

const homeViewCommands = {
  Refresh: "posit.publisher.homeView.refresh",
  ShowSelectConfigForDeployment:
    "posit.publisher.homeView.showSelectConfigForDeployment",
  AssociateDeployment: "posit.publisher.homeView.associateDeployment",
  CreateConfigForDeployment:
    "posit.publisher.homeView.createConfigForDeployment",
  SelectDeployment: "posit.publisher.homeView.selectDeployment",
  NewDeployment: "posit.publisher.homeView.newDeployment",
  NavigateToDeploymentServer:
    "posit.publisher.homeView.navigateToDeployment.Server",
  NavigateToDeploymentContent:
    "posit.publisher.homeView.navigateToDeployment.Content",
  ShowContentLogs: "posit.publisher.homeView.navigateToDeployment.ContentLog",
  OpenFeedback: "posit.publisher.homeView.openFeedback",
  OpenGettingStarted: "posit.publisher.homeView.gettingStarted",
  AddCredential: "posit.publisher.homeView.addCredential",
  DeleteCredential: "posit.publisher.homeView.deleteCredential",
  RefreshCredentials: "posit.publisher.homeView.refreshCredentials",
  AddIntegrationRequest: "posit.publisher.homeView.addIntegrationRequest",
  RemoveSecret: "posit.publisher.homeView.removeSecret",
  EditCurrentConfiguration: "posit.publisher.homeView.edit.Configuration",
  CopySystemInfo: "posit.publisher.homeView.copySystemInfo",
  // Added automatically by VSCode with view registration
  Focus: "posit.publisher.homeView.focus",
} as const;

const homeViewContexts = {
  Initialized: "posit.publisher.homeView.initialized",
  UserHasInitiatedDeployment:
    "posit.publisher.homeView.userHasInitiatedDeploymentOperation",
};

export const LocalState = {
  LastSelectionState: "posit.publisher.homeView.lastDeploymentSelectedState",
};

export const Commands = {
  ...baseCommands,
  Logs: logsCommands,
  Files: filesCommands,
  PythonPackages: pythonPackagesCommands,
  RPackages: rPackagesCommands,
  HomeView: homeViewCommands,
};

export const Contexts = {
  ...baseContexts,
  Credentials: credentialsContexts,
  HomeView: homeViewContexts,
};

export const enum Views {
  Project = "posit.publisher.project",
  HomeView = "posit.publisher.homeView",
  Logs = "posit.publisher.logs",
}

export const DebounceDelaysMS = {
  file: 1000,
  refreshRPackages: 1000,
  refreshPythonPackages: 1000,
};

export const CONNECT_CLOUD_ENV = config.env;
export const CONNECT_CLOUD_SIGNUP_URL = `${config.connectCloudURL}/logout?redirect=${config.cloudURL}/register?redirect=`;
export const CONNECT_CLOUD_ACCOUNT_URL = `${config.connectCloudURL}/account/done`;

export const CONNECT_CLOUD_ENV_HEADER = {
  "Connect-Cloud-Environment": CONNECT_CLOUD_ENV,
};

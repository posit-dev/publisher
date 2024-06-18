// Copyright (C) 2024 by Posit Software, PBC.

export const POSIT_FOLDER = ".posit";
export const PUBLISH_FOLDER = ".posit/publish";
export const PUBLISH_DEPLOYMENTS_FOLDER = ".posit/publish/deployments";

export const CONFIGURATIONS_PATTERN = ".posit/publish/*.toml";
export const DEPLOYMENTS_PATTERN = ".posit/publish/deployments/*.toml";

export const DEFAULT_PYTHON_PACKAGE_FILE = "requirements.txt";
export const DEFAULT_R_PACKAGE_FILE = "renv.lock";

const baseCommands = {
  InitProject: "posit.publisher.init-project",
  ShowOutputChannel: "posit.publisher.showOutputChannel",
  ShowPublishingLog: "posit.publisher.showPublishingLog",
} as const;

const logsCommands = {
  Visit: "posit.publisher.logs.visit",
  // Added automatically by VSCode with view registration
  Focus: "posit.publisher.logs.focus",
  ToggleVisibility: "posit.publisher.logs.toggleVisibility",
} as const;

const configurationsCommands = {
  Refresh: "posit.publisher.configurations.refresh",
  New: "posit.publisher.configurations.add",
  Clone: "posit.publisher.configurations.clone",
  Edit: "posit.publisher.configurations.edit",
  Rename: "posit.publisher.configurations.rename",
  Delete: "posit.publisher.configurations.delete",
} as const;

const credentialsCommands = {
  Add: "posit.publisher.credentials.add",
  Delete: "posit.publisher.credentials.delete",
  Refresh: "posit.publisher.credentials.refresh",
} as const;

const contentRecordsCommands = {
  Edit: "posit.publisher.contentRecords.edit",
  Rename: "posit.publisher.contentRecords.rename",
  Forget: "posit.publisher.contentRecords.forget",
  Visit: "posit.publisher.contentRecords.visit",
  Refresh: "posit.publisher.contentRecords.refresh",
} as const;

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
  Scan: "posit.publisher.rPackages.scan",
} as const;

const homeViewCommands = {
  Refresh: "posit.publisher.homeView.refresh",
  SelectConfigForDeployment:
    "posit.publisher.homeView.selectConfigForDeployment",
  CreateConfigForDeployment:
    "posit.publisher.homeView.createConfigForDeployment",
  SelectDeployment: "posit.publisher.homeView.selectDeployment",
  NewDeployment: "posit.publisher.homeView.newDeployment",
  NavigateToDeploymentServer:
    "posit.publisher.homeView.navigateToDeployment.Server",
  NavigateToDeploymentContent:
    "posit.publisher.homeView.navigateToDeployment.Content",
  ShowContentLogs: "posit.publisher.homeView.navigateToDeployment.ContentLog",
  LoadContent: "posit.publisher.homeView.loadContent",
  ContentBrowser: "posit.publisher.contentBrowser",
} as const;

const helpAndFeedbackCommands = {
  OpenFeedback: "posit.publisher.helpAndFeedback.openFeedback",
  OpenGettingStarted: "posit.publisher.helpAndFeedback.gettingStarted",
} as const;

export const Commands = {
  ...baseCommands,
  Configurations: configurationsCommands,
  Credentials: credentialsCommands,
  ContentRecords: contentRecordsCommands,
  Logs: logsCommands,
  Files: filesCommands,
  PythonPackages: pythonPackagesCommands,
  RPackages: rPackagesCommands,
  HomeView: homeViewCommands,
  HelpAndFeedback: helpAndFeedbackCommands,
} as const;

export const enum Views {
  Project = "posit.publisher.project",
  HomeView = "posit.publisher.homeView",
  Configurations = "posit.publisher.configurations",
  Credentials = "posit.publisher.credentials",
  ContentRecords = "posit.publisher.contentRecords",
  HelpAndFeedback = "posit.publisher.helpAndFeedback",
  Logs = "posit.publisher.logs",
}

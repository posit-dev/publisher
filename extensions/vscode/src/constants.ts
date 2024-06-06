// Copyright (C) 2024 by Posit Software, PBC.

export const POSIT_FOLDER = ".posit";
export const PUBLISH_FOLDER = ".posit/publish";
export const PUBLISH_DEPLOYMENTS_FOLDER = ".posit/publish/deployments";

export const CONFIGURATIONS_PATTERN = ".posit/publish/*.toml";
export const DEPLOYMENTS_PATTERN = ".posit/publish/deployments/*.toml";

export const DEFAULT_PYTHON_PACKAGE_FILE = "requirements.txt";
export const DEFAULT_R_PACKAGE_FILE = "renv.lock";

export const enum Commands {
  InitProject = "posit.publisher.init-project",
  // RefreshProjectInitialization = "posit.publisher.init-project.refresh",
  ConfigurationsRefresh = "posit.publisher.configurations.refresh",
  ConfigurationNew = "posit.publisher.configurations.add",
  ConfigurationClone = "posit.publisher.configurations.clone",
  ConfigurationEdit = "posit.publisher.configurations.edit",
  ConfigurationRename = "posit.publisher.configurations.rename",
  ConfigurationDelete = "posit.publisher.configurations.delete",
  CredentialAdd = "posit.publisher.credentials.add",
  CredentialDelete = "posit.publisher.credentials.delete",
  CredentialRefresh = "posit.publisher.credentials.refresh",
  ContentRecordEdit = "posit.publisher.contentRecords.edit",
  ContentRecordRename = "posit.publisher.contentRecords.rename",
  ContentRecordForget = "posit.publisher.contentRecords.forget",
  ContentRecordVisit = "posit.publisher.contentRecords.visit",
  ContentRecordsRefresh = "posit.publisher.contentRecords.refresh",
  RefreshDeploymentFiles = "posit.publisher.files.refresh",
  ExcludeFile = "posit.publisher.files.exclude",
  IncludeFile = "posit.publisher.files.include",
  EditRequirementsFile = "posit.publisher.pythonPackages.edit",
  RefreshRequirements = "posit.publisher.pythonPackages.refresh",
  ScanRequirements = "posit.publisher.pythonPackages.scan",
  HomeViewRefresh = "posit.publisher.homeView.refresh",
  HomeViewSelectConfigForDeployment = "posit.publisher.homeView.selectConfigForDeployment",
  HomeViewCreateConfigForDeployment = "posit.publisher.homeView.createConfigForDeployment",
  HomeViewSelectDeployment = "posit.publisher.homeView.selectDeployment",
  HomeViewNewDeployment = "posit.publisher.homeView.newDeployment",
  HelpOpenGettingStarted = "posit.publisher.helpAndFeedback.gettingStarted",
  HelpOpenFeedback = "posit.publisher.helpAndFeedback.openFeedback",

  // Logs Commands
  LogsVisit = "posit.publisher.logs.visit",
  // Added automatically by VSCode with view registration
  LogsFocus = "posit.publisher.logs.focus",
  LogsToggleVisibility = "posit.publisher.logs.toggleVisibility",

  HomeViewNavigateToDeploymentServer = "posit.publisher.homeView.navigateToDeployment.Server",
  HomeViewNavigateToDeploymentContent = "posit.publisher.homeView.navigateToDeployment.Content",
  ShowOutputChannel = "posit.publisher.showOutputChannel",
  ShowPublishingLog = "posit.publisher.showPublishingLog",
  HomeViewShowContentLogs = "posit.publisher.homeView.navigateToDeployment.ContentLog",
}

export const enum Views {
  Project = "posit.publisher.project",
  HomeView = "posit.publisher.homeView",
  Configurations = "posit.publisher.configurations",
  Credentials = "posit.publisher.credentials",
  ContentRecords = "posit.publisher.contentRecords",
  HelpAndFeedback = "posit.publisher.helpAndFeedback",
  Logs = "posit.publisher.logs",
}

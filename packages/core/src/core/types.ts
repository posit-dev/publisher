// Copyright (C) 2026 by Posit Software, PBC.

/**
 * Domain types for project configurations.
 *
 * These types represent the structure of `.posit/publish/*.toml` configuration
 * files. They are translated from the Go types in `internal/config/types.go`
 * and the extension types in `extensions/vscode/src/api/types/configurations.ts`.
 *
 * Domain types belong to the core and have no dependencies on infrastructure
 * (no Node.js APIs, VS Code APIs, HTTP libraries, or TOML parsers).
 */

// --- Content and Product Types ---

export type ContentType =
  | "html"
  | "jupyter-notebook"
  | "jupyter-voila"
  | "python-bokeh"
  | "python-dash"
  | "python-fastapi"
  | "python-flask"
  | "python-shiny"
  | "python-streamlit"
  | "python-gradio"
  | "python-panel"
  | "quarto-shiny"
  | "quarto"
  | "quarto-static"
  | "r-plumber"
  | "r-shiny"
  | "rmd-shiny"
  | "rmd"
  | "unknown";

export type ProductType = "connect" | "connect_cloud";

// --- Interpreter and Package Configs ---

export interface PythonConfig {
  version?: string;
  packageFile?: string;
  packageManager?: string;
  requiresPython?: string;
}

export interface RConfig {
  version?: string;
  packageFile?: string;
  packageManager?: string;
  requiresR?: string;
  packagesFromLibrary?: boolean;
}

export interface QuartoConfig {
  version?: string;
  engines?: string[];
}

export interface JupyterConfig {
  hideAllInput?: boolean;
  hideTaggedInput?: boolean;
}

// --- Connect Server Settings ---

export interface ConnectAccess {
  runAs?: string;
  runAsCurrentUser?: boolean;
}

export interface ConnectRuntime {
  connectionTimeout?: number;
  readTimeout?: number;
  initTimeout?: number;
  idleTimeout?: number;
  maxProcesses?: number;
  minProcesses?: number;
  maxConnsPerProcess?: number;
  loadFactor?: number;
}

export interface ConnectKubernetes {
  memoryRequest?: number;
  memoryLimit?: number;
  cpuRequest?: number;
  cpuLimit?: number;
  amdGpuLimit?: number;
  nvidiaGpuLimit?: number;
  serviceAccountName?: string;
  defaultImageName?: string;
  defaultREnvironmentManagement?: boolean;
  defaultPyEnvironmentManagement?: boolean;
}

export interface ConnectAccessControl {
  type?: AccessType;
  users?: User[];
  groups?: Group[];
}

export interface ConnectSettings {
  access?: ConnectAccess;
  accessControl?: ConnectAccessControl;
  runtime?: ConnectRuntime;
  kubernetes?: ConnectKubernetes;
}

// --- Connect Cloud Settings ---

export type OrganizationAccessType = "disabled" | "viewer" | "editor";

export interface ConnectCloudAccessControl {
  publicAccess?: boolean;
  organizationAccess?: OrganizationAccessType;
}

export interface ConnectCloudSettings {
  vanityName?: string;
  accessControl?: ConnectCloudAccessControl;
}

// --- Access Control ---

export type AccessType = "all" | "logged-in" | "acl";

export interface User {
  id?: string;
  guid?: string;
  name?: string;
  permissions: string;
}

export interface Group {
  id?: string;
  guid?: string;
  name?: string;
  permissions: string;
}

// --- Scheduling ---

export interface Schedule {
  start?: string;
  recurrence?: string;
}

// --- Integration Requests ---

export interface IntegrationRequest {
  guid?: string;
  name?: string;
  description?: string;
  authType?: string;
  type?: string;
  config?: Record<string, unknown>;
}

// --- Environment ---

export type Environment = Record<string, string>;

// --- Configuration (the main domain object) ---

/**
 * A deployment configuration describing how to publish content to
 * Posit Connect or Connect Cloud.
 *
 * Corresponds to the contents of a `.posit/publish/<name>.toml` file.
 */
export interface Configuration {
  "$schema"?: string;
  productType?: ProductType;
  type: ContentType;
  entrypoint?: string;
  source?: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  tags?: string[];
  validate?: boolean;
  hasParameters?: boolean;
  files?: string[];
  secrets?: string[];
  python?: PythonConfig;
  r?: RConfig;
  quarto?: QuartoConfig;
  jupyter?: JupyterConfig;
  environment?: Environment;
  schedules?: Schedule[];
  connect?: ConnectSettings;
  connectCloud?: ConnectCloudSettings;
  integrationRequests?: IntegrationRequest[];
}

// --- Configuration Summary (for list results) ---

/**
 * A summary entry returned when listing configurations. Each entry
 * includes either a successfully parsed configuration or an error
 * message, allowing callers to display partial results when some
 * config files fail to parse.
 */
export type ConfigurationSummary =
  | { name: string; projectDir: string; configuration: Configuration }
  | { name: string; projectDir: string; error: string };

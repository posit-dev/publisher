// Copyright (C) 2026 by Posit Software, PBC.

// ---------------------------------------------------------------------------
// Branded ID types — opaque strings for type safety
// ---------------------------------------------------------------------------

export type ContentID = string & { readonly __brand: "ContentID" };
export type BundleID = string & { readonly __brand: "BundleID" };
export type TaskID = string & { readonly __brand: "TaskID" };
export type UserID = string & { readonly __brand: "UserID" };
export type GUID = string & { readonly __brand: "GUID" };
export type ContentName = string & { readonly __brand: "ContentName" };
export type Int64Str = string & { readonly __brand: "Int64Str" };
export type CloudAuthToken = string & { readonly __brand: "CloudAuthToken" };

export const ContentID = (id: string) => id as ContentID;
export const BundleID = (id: string) => id as BundleID;
export const TaskID = (id: string) => id as TaskID;
export const UserID = (id: string) => id as UserID;
export const GUID = (id: string) => id as GUID;
export const ContentName = (name: string) => name as ContentName;
export const Int64Str = (value: string) => value as Int64Str;
export const CloudAuthToken = (token: string) => token as CloudAuthToken;

// ---------------------------------------------------------------------------
// Cloud environment enum
// ---------------------------------------------------------------------------

export enum CloudEnvironment {
  Development = "development",
  Staging = "staging",
  Production = "production",
}

// ---------------------------------------------------------------------------
// Client options
// ---------------------------------------------------------------------------

export interface ConnectAPIOptions {
  url: string;
  apiKey: string;
}

// ---------------------------------------------------------------------------
// User types
// ---------------------------------------------------------------------------

/** Simplified user structure common to all servers. */
export interface User {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
}

/** User DTO from the Connect API. */
export interface UserDTO {
  guid: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  user_role: string;
  created_time: string;
  updated_time: string;
  active_time: string | null;
  confirmed: boolean;
  locked: boolean;
}

// ---------------------------------------------------------------------------
// Content types
// ---------------------------------------------------------------------------

/** Content body for create/update requests. */
export interface ConnectContent {
  app_mode?: string;
  name?: string;
  title?: string;
  guid?: string;
  description?: string;
  access_type?: string;
  connection_timeout?: number | null;
  read_timeout?: number | null;
  init_timeout?: number | null;
  idle_timeout?: number | null;
  max_processes?: number | null;
  min_processes?: number | null;
  max_conns_per_process?: number | null;
  load_factor?: number | null;
  run_as?: string;
  run_as_current_user?: boolean;
  memory_request?: number | null;
  memory_limit?: number | null;
  cpu_request?: number | null;
  cpu_limit?: number | null;
  amd_gpu_limit?: number | null;
  nvidia_gpu_limit?: number | null;
  service_account_name?: string;
  default_image_name?: string;
  default_r_environment_management?: boolean;
  default_py_environment_management?: boolean;
  locked?: boolean;
}

/** Content details DTO returned by GET /content/:id. */
export interface ContentDetailsDTO {
  guid: string;
  name: string;
  title: string | null;
  description: string;
  access_type: string;
  connection_timeout: number | null;
  read_timeout: number | null;
  init_timeout: number | null;
  idle_timeout: number | null;
  max_processes: number | null;
  min_processes: number | null;
  max_conns_per_process: number | null;
  load_factor: number | null;
  created_time: string;
  last_deployed_time: string;
  bundle_id: string | null;
  app_mode: string;
  content_category: string;
  parameterized: boolean;
  cluster_name: string | null;
  image_name: string | null;
  r_version: string | null;
  py_version: string | null;
  quarto_version: string | null;
  run_as: string | null;
  run_as_current_user: boolean;
  owner_guid: string;
  content_url: string;
  dashboard_url: string;
  app_role: string;
  id: string;
}

// ---------------------------------------------------------------------------
// Integration type
// ---------------------------------------------------------------------------

export interface Integration {
  guid: string;
  name: string;
  description: string;
  auth_type: string;
  template: string;
  config: Record<string, unknown>;
  created_time: string;
}

// ---------------------------------------------------------------------------
// Bundle types
// ---------------------------------------------------------------------------

export interface BundleDTO {
  id: string;
  content_guid: string;
  created_time: string;
  cluster_name: string | null;
  image_name: string | null;
  r_version: string | null;
  py_version: string | null;
  quarto_version: string | null;
  active: boolean;
  size: number;
  metadata: {
    source: string | null;
    source_repo: string | null;
    source_branch: string | null;
    source_commit: string | null;
    archive_md5: string | null;
    archive_sha1: string | null;
  };
}

// ---------------------------------------------------------------------------
// Deploy / Task types
// ---------------------------------------------------------------------------

export interface DeployOutput {
  task_id: string;
}

export interface TaskDTO {
  id: string;
  output: string[];
  result: unknown;
  finished: boolean;
  code: number;
  error: string;
  last: number;
}

// ---------------------------------------------------------------------------
// Environment variable type
// ---------------------------------------------------------------------------

export interface EnvVar {
  name: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Server settings types
// ---------------------------------------------------------------------------

export interface LicenseStatus {
  "allow-apis": boolean;
  "current-user-execution": boolean;
  "enable-launcher": boolean;
  "oauth-integrations": boolean;
}

export interface ServerSettings {
  license: LicenseStatus;
  runtimes: string[];
  git_enabled: boolean;
  git_available: boolean;
  execution_type: string;
  enable_runtime_constraints: boolean;
  enable_image_management: boolean;
  default_image_selection_enabled: boolean;
  default_environment_management_selection: boolean;
  default_r_environment_management: boolean;
  default_py_environment_management: boolean;
  oauth_integrations_enabled: boolean;
}

export interface ApplicationSettings {
  access_types: string[];
  run_as: string;
  run_as_group: string;
  run_as_current_user: boolean;
}

export interface SchedulerSettings {
  min_processes: number;
  max_processes: number;
  max_conns_per_process: number;
  load_factor: number;
  init_timeout: number;
  idle_timeout: number;
  min_processes_limit: number;
  max_processes_limit: number;
  connection_timeout: number;
  read_timeout: number;
  cpu_request: number;
  max_cpu_request: number;
  cpu_limit: number;
  max_cpu_limit: number;
  memory_request: number;
  max_memory_request: number;
  memory_limit: number;
  max_memory_limit: number;
  amd_gpu_limit: number;
  max_amd_gpu_limit: number;
  nvidia_gpu_limit: number;
  max_nvidia_gpu_limit: number;
}

export interface PyInstallation {
  version: string;
  cluster_name: string;
  image_name: string;
}

export interface PyInfo {
  installations: PyInstallation[];
  api_enabled: boolean;
}

export interface RInstallation {
  version: string;
  cluster_name: string;
  image_name: string;
}

export interface RInfo {
  installations: RInstallation[];
}

export interface QuartoInstallation {
  version: string;
  cluster_name: string;
  image_name: string;
}

export interface QuartoInfo {
  installations: QuartoInstallation[];
}

/** Composite settings from all 7 server endpoints. */
export interface AllSettings {
  general: ServerSettings;
  user: UserDTO;
  application: ApplicationSettings;
  scheduler: SchedulerSettings;
  python: PyInfo;
  r: RInfo;
  quarto: QuartoInfo;
}

// Copyright (C) 2026 by Posit Software, PBC.

// ---------------------------------------------------------------------------
// Branded ID types — opaque strings for type safety
// ---------------------------------------------------------------------------

export type ContentID = string & { readonly __brand: "ContentID" };
export type CloudAuthToken = string & { readonly __brand: "CloudAuthToken" };

export const ContentID = (id: string) => id as ContentID;
export const CloudAuthToken = (token: string) => token as CloudAuthToken;

// ---------------------------------------------------------------------------
// Client options
// ---------------------------------------------------------------------------

export interface ConnectCloudAPIOptions {
  apiBaseUrl: string;
  accessToken: string;
  /** Required for token refresh on 401. */
  refreshToken?: string;
  /** Required for token refresh on 401. */
  environment?: CloudEnvironment;
  /** Called after successful token refresh so caller can persist new tokens. */
  onTokenRefresh?: (tokens: TokenResponse) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Cloud environment
// ---------------------------------------------------------------------------

export enum CloudEnvironment {
  Development = "development",
  Staging = "staging",
  Production = "production",
}

export const cloudEnvironmentBaseUrls: Record<CloudEnvironment, string> = {
  [CloudEnvironment.Development]: "https://api.dev.connect.posit.cloud",
  [CloudEnvironment.Staging]: "https://api.staging.connect.posit.cloud",
  [CloudEnvironment.Production]: "https://api.connect.posit.cloud",
};

// ---------------------------------------------------------------------------
// Auth base URLs and client IDs (from cloud_auth/client_cloud_auth.go)
// ---------------------------------------------------------------------------

export const cloudAuthBaseUrls: Record<CloudEnvironment, string> = {
  [CloudEnvironment.Development]: "https://login.staging.posit.cloud",
  [CloudEnvironment.Staging]: "https://login.staging.posit.cloud",
  [CloudEnvironment.Production]: "https://login.posit.cloud",
};

export const cloudAuthClientIds: Record<CloudEnvironment, string> = {
  [CloudEnvironment.Development]: "posit-publisher-development",
  [CloudEnvironment.Staging]: "posit-publisher-staging",
  [CloudEnvironment.Production]: "posit-publisher",
};

// ---------------------------------------------------------------------------
// OAuth token types (from cloud_auth/oauth.go)
// ---------------------------------------------------------------------------

export type TokenRequest =
  | { grant_type: "refresh_token"; refresh_token: string }
  | {
      grant_type: "urn:ietf:params:oauth:grant-type:device_code";
      device_code: string;
    };

export interface DeviceAuthResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

// ---------------------------------------------------------------------------
// Account types (from connect_cloud/account.go)
// ---------------------------------------------------------------------------

export interface AccountEntitlement {
  enabled: boolean;
}

export interface AccountEntitlements {
  account_private_content_flag: AccountEntitlement;
}

export interface AccountLicense {
  entitlements: AccountEntitlements;
}

export interface Account {
  id: string;
  name: string;
  display_name: string;
  permissions: string[];
  license: AccountLicense | null;
}

export interface AccountListResponse {
  data: Account[];
}

// ---------------------------------------------------------------------------
// User types (from connect_cloud/user.go and clients/types/types.go)
// ---------------------------------------------------------------------------

export interface UserAccountRoleAccount {
  name: string;
}

export interface UserAccountRole {
  role: string;
  account: UserAccountRoleAccount;
}

export interface UserResponse {
  account_roles: Record<string, UserAccountRole>;
}

// ---------------------------------------------------------------------------
// Content access and type enums (from clients/types/types.go)
// ---------------------------------------------------------------------------

export enum ContentAccess {
  ViewPrivateEditPrivate = "view_private_edit_private",
  ViewTeamEditPrivate = "view_team_edit_private",
  ViewTeamEditTeam = "view_team_edit_team",
  ViewPublicEditPrivate = "view_public_edit_private",
  ViewPublicEditTeam = "view_public_edit_team",
}

export enum ContentType {
  Bokeh = "bokeh",
  Dash = "dash",
  Jupyter = "jupyter",
  Quarto = "quarto",
  Shiny = "shiny",
  Streamlit = "streamlit",
  RMarkdown = "rmarkdown",
  Static = "static",
}

// ---------------------------------------------------------------------------
// Secrets and connect options (from clients/types/types.go)
// ---------------------------------------------------------------------------

export interface Secret {
  name: string;
  value: string;
}

export interface ConnectOptions {
  client_reconnect_timeout?: number | null;
  conn_timeout?: number | null;
  disconnect_delay?: number | null;
  heartbeat_delay?: number | null;
  idle_timeout?: number | null;
  init_timeout?: number | null;
  read_timeout?: number | null;
  sched_load_factor?: number | null;
  sched_max_conns?: number | null;
  sched_max_proc?: number | null;
  sched_min_proc?: number | null;
  shiny_isolation?: boolean | null;
  shiny_stale_worker_redirects?: boolean | null;
}

// ---------------------------------------------------------------------------
// Revision types (from clients/types/types.go)
// ---------------------------------------------------------------------------

export enum PublishResult {
  Success = "success",
  Failure = "failure",
}

export interface RequestRevision {
  source_type: string;
  python_version?: string;
  content_type?: ContentType;
  primary_file?: string;
  connect_options?: ConnectOptions;
}

export interface Revision {
  id: string;
  publish_log_channel: string;
  publish_result: PublishResult | null;
  publish_error_code?: string;
  publish_error_args?: Record<string, unknown>;
  source_bundle_id: string;
  source_bundle_upload_url: string;
  publish_error?: string;
  publish_error_details?: string;
}

// ---------------------------------------------------------------------------
// Content request/response types (from clients/types/types.go)
// ---------------------------------------------------------------------------

export interface ContentRequestBase {
  title: string;
  description?: string;
  next_revision?: RequestRevision;
  revision_overrides?: RequestRevision;
  access?: ContentAccess;
  secrets?: Secret[];
  vanity_name?: string;
  content_type: ContentType;
}

export interface CreateContentRequest extends ContentRequestBase {
  account_id: string;
}

export interface UpdateContentRequest extends Partial<ContentRequestBase> {
  content_id: ContentID;
}

export interface ContentResponse {
  id: ContentID;
  next_revision?: Revision;
  access: ContentAccess;
}

// ---------------------------------------------------------------------------
// Authorization types (from clients/types/types.go)
// ---------------------------------------------------------------------------

export interface AuthorizationRequest {
  resource_type: string;
  resource_id: string;
  permission: string;
}

export interface AuthorizationResponse {
  authorized: boolean;
  token?: string;
}

// ---------------------------------------------------------------------------
// Cloud logs base URLs
// ---------------------------------------------------------------------------

export const cloudLogsBaseUrls: Record<CloudEnvironment, string> = {
  [CloudEnvironment.Development]: "https://logs.dev.connect.posit.cloud",
  [CloudEnvironment.Staging]: "https://logs.staging.connect.posit.cloud",
  [CloudEnvironment.Production]: "https://logs.connect.posit.cloud",
};

// ---------------------------------------------------------------------------
// Log streaming types (from connect_cloud_logs/types.go)
// ---------------------------------------------------------------------------

export type LogLevel = "debug" | "info" | "error";

export type LogEntryType = "build" | "runtime";

export interface LogEntry {
  timestamp: number;
  sort_key: number;
  message: string;
  type: LogEntryType;
  level: LogLevel;
}

export type LogLine = Pick<LogEntry, "level" | "message">;

/**
 * Shape of each SSE event's JSON `data` field from the Cloud logs endpoint.
 * Each event contains an array of log messages.
 */
export interface LogsEventData {
  data: LogEntry[];
}

export interface WatchLogsOptions {
  environment: CloudEnvironment;
  logChannel: string;
  authToken: string;
  onLog: (line: LogLine) => void;
  signal?: AbortSignal;
}

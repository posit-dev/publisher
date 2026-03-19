// Copyright (C) 2026 by Posit Software, PBC.

// ---------------------------------------------------------------------------
// Branded ID types — opaque strings for type safety
// ---------------------------------------------------------------------------

export type ContentID = string & { readonly __brand: "ContentID" };

export const ContentID = (id: string) => id as ContentID;

// ---------------------------------------------------------------------------
// Client options
// ---------------------------------------------------------------------------

export interface ConnectCloudAPIOptions {
  apiBaseUrl: string;
  accessToken: string;
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
  publish_result: PublishResult;
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

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

export interface TokenRequest {
  grant_type: "refresh_token";
  refresh_token: string;
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
  Private = "private",
  ViewPrivateEditPrivate = "view_private_edit_private",
  ViewTeamEditPrivate = "view_team_edit_private",
  ViewTeamEditTeam = "view_team_edit_team",
  Public = "public",
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
// Author type (embedded in content and revision responses)
// ---------------------------------------------------------------------------

export interface Author {
  id: string;
  display_name: string;
  avatar_url?: string;
  created_time: string;
  updated_time: string;
}

// ---------------------------------------------------------------------------
// User role on content
// ---------------------------------------------------------------------------

export interface ContentUserRole {
  id: string;
  user_id: string;
  content_id: ContentID;
  role: string;
  created_time: string;
  updated_time: string;
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
  content_id: ContentID;
  author_id: string;
  author?: Author;

  // Source info
  source_type: string;
  source_bundle_id: string;
  source_bundle_upload_url: string;
  source_provider?: string;
  source_ref?: string | null;
  source_ref_type?: string | null;
  source_repository_url?: string | null;

  // Content config
  app_mode?: string;
  content_type?: ContentType;
  type?: string;
  primary_file?: string;
  connect_options?: ConnectOptions;

  // Runtime config
  cpu?: number;
  memory?: number;
  operating_system?: string;
  execution_time_limit?: number;
  python_version?: string | null;
  r_version?: string | null;
  quarto_version?: string | null;

  // Publish state
  state?: string;
  status?: string | null;
  trigger?: string;
  publish_log_channel?: string | null;
  publish_result?: PublishResult | null;
  publish_start_time?: string | null;
  publish_end_time?: string | null;
  publish_error?: string | null;
  publish_error_code?: string | null;
  publish_error_args?: Record<string, unknown> | null;
  publish_error_details?: string | null;

  // Other
  build_context?: string | null;
  commit_sha?: string | null;
  permissions?: string[];
  url?: string | null;
  created_time: string;
  updated_time: string;
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
  account_id: string;
  title: string;
  access: ContentAccess;

  // Author
  author_id: string;
  author?: Author;

  // Revisions
  current_revision?: Revision | null;
  next_revision?: Revision | null;

  // Timestamps
  created_time: string;
  updated_time: string;

  // Optional metadata
  description?: string | null;
  domain_id?: string | null;
  auto_publish?: boolean;

  // Access control
  permissions?: string[];
  role?: string;
  user_roles?: Record<string, ContentUserRole>;
  private_link_enabled?: boolean;
  private_link_token?: string | null;
  private_link_token_hash?: string;

  // Display
  show_thumbnail?: string;
  thumbnail_format?: string | null;
  thumbnail_image?: string | null;

  // Source control
  source_branch?: string | null;
  source_repository_url?: string | null;

  // Other
  state?: string;
  vanity_name?: string | null;
  vanity_domain?: string | null;
  oauth_client_id?: string;
  schedules?: unknown[];
  secrets?: Secret[];
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

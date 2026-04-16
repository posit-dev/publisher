// Copyright (C) 2026 by Posit Software, PBC.

import {
  CloudEnvironment,
  ConnectCloudAPI,
  ContentAccess,
  ContentType as CloudContentType,
  CreateContentRequest,
  UpdateContentRequest,
  ContentRequestBase,
  RequestRevision,
  ConnectOptions,
  Secret,
  ContentID,
} from "@posit-dev/connect-cloud-api";
import { ContentType } from "../api/types/configurations";
import type {
  ConfigurationDetails,
  ConnectCloudAccessControl,
} from "../api/types/configurations";
import type { ConnectRuntime } from "../api/types/connect";
import { logger } from "../logging";

// ---------------------------------------------------------------------------
// Credential Info Type
// ---------------------------------------------------------------------------

export interface CloudCredentialInfo {
  accountId: string;
  accountName: string;
  environment: CloudEnvironment;
}

// ---------------------------------------------------------------------------
// Content Type Mapping
// ---------------------------------------------------------------------------

/**
 * Maps publisher content types to Connect Cloud content types.
 * @throws Error if the content type is not supported by Connect Cloud.
 */
export function cloudContentTypeFromPublisherType(
  contentType: ContentType,
): CloudContentType {
  switch (contentType) {
    case ContentType.JUPYTER_NOTEBOOK:
      return CloudContentType.Jupyter;
    case ContentType.PYTHON_BOKEH:
      return CloudContentType.Bokeh;
    case ContentType.PYTHON_DASH:
      return CloudContentType.Dash;
    case ContentType.PYTHON_SHINY:
    case ContentType.R_SHINY:
      return CloudContentType.Shiny;
    case ContentType.PYTHON_STREAMLIT:
      return CloudContentType.Streamlit;
    case ContentType.QUARTO:
    case ContentType.QUARTO_SHINY:
    case ContentType.QUARTO_STATIC:
      return CloudContentType.Quarto;
    case ContentType.RMD:
    case ContentType.RMD_SHINY:
      return CloudContentType.RMarkdown;
    case ContentType.HTML:
      return CloudContentType.Static;
    default:
      throw new Error(
        `content type '${contentType}' is not supported by Connect Cloud`,
      );
  }
}

// ---------------------------------------------------------------------------
// Cloud URL Construction
// ---------------------------------------------------------------------------

export function getCloudUIURL(env: CloudEnvironment): string {
  switch (env) {
    case CloudEnvironment.Development:
      return "https://dev.connect.posit.cloud";
    case CloudEnvironment.Staging:
      return "https://staging.connect.posit.cloud";
    case CloudEnvironment.Production:
      return "https://connect.posit.cloud";
  }
}

function getCloudShareDomain(env: CloudEnvironment): string {
  switch (env) {
    case CloudEnvironment.Development:
      return "share.dev.connect.posit.cloud";
    case CloudEnvironment.Staging:
      return "share.staging.connect.posit.cloud";
    case CloudEnvironment.Production:
      return "share.connect.posit.cloud";
  }
}

export interface CloudContentInfo {
  dashboardURL: string;
  directURL: string;
  logsURL: string;
}

/**
 * Constructs URLs for the Connect Cloud dashboard, direct content access, and logs.
 */
export function getCloudContentInfo(
  credential: CloudCredentialInfo,
  contentId: ContentID,
): CloudContentInfo {
  const uiBaseURL = getCloudUIURL(credential.environment);
  const dashboardURL = `${uiBaseURL}/${credential.accountName}/content/${contentId}`;
  const shareDomain = getCloudShareDomain(credential.environment);
  const directURL = `https://${contentId}.${shareDomain}`;
  const logsURL = `${dashboardURL}/history`;
  return { dashboardURL, directURL, logsURL };
}

// ---------------------------------------------------------------------------
// Access Control
//
// ContentAccess encodes two independent dimensions in one enum value:
//
//   View{Public|Team|Private}Edit{Team|Private}
//   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//   visibility dimension      edit dimension
//
// Visibility (View prefix) is driven by publicAccess:
//   Public  → anyone (publicAccess = true)
//   Team    → org members (publicAccess = false, orgAccess ≠ disabled)
//   Private → owner only (publicAccess = false, orgAccess = disabled)
//
// Edit permission (Edit suffix) is driven by orgAccess:
//   Team    → org members can edit (orgAccess = editor)
//   Private → only the owner can edit (orgAccess = viewer, disabled, or unset)
//
// Forward mapping (publicAccess × orgAccess → ContentAccess):
//
//   public=true,  org=disabled → ViewPublicEditPrivate
//   public=true,  org=viewer   → ViewPublicEditPrivate
//   public=true,  org=editor   → ViewPublicEditTeam
//   public=false, org=disabled → ViewPrivateEditPrivate
//   public=false, org=viewer   → ViewTeamEditPrivate
//   public=false, org=editor   → ViewTeamEditTeam
//
// Note: orgAccess=viewer and orgAccess=disabled both map to EditPrivate,
// so the forward mapping is lossy — you can't distinguish them from the
// enum value alone. The reverse functions below decode EditPrivate as
// "disabled" (or "viewer" when ViewTeam is present) and EditTeam as
// "editor".
//
// See also: Go implementation in internal/publish/connect_cloud/content_request_base.go
// ---------------------------------------------------------------------------

/**
 * Derives the orgAccess dimension from an existing ContentAccess value.
 * Used during redeploy partial merges to preserve the dimension the user
 * didn't explicitly set.
 */
function deriveOrgAccessFromContentAccess(
  access: ContentAccess,
): "viewer" | "editor" | "disabled" {
  switch (access) {
    case ContentAccess.ViewPrivateEditPrivate:
    case ContentAccess.ViewPublicEditPrivate:
      return "disabled";
    case ContentAccess.ViewTeamEditPrivate:
      return "viewer";
    // Diverges from Go (content_request_base.go:67-68), which groups
    // ViewPublicEditTeam with ViewTeamEditPrivate under "viewer". That's
    // lossy: on redeploy with only publicAccess set, org=editor silently
    // downgrades to org=viewer. We return "editor" to preserve the
    // original setting.
    case ContentAccess.ViewPublicEditTeam:
    case ContentAccess.ViewTeamEditTeam:
      return "editor";
  }
}

/**
 * Derives the publicAccess dimension from an existing ContentAccess value.
 * "Public" in the View prefix means publicAccess=true.
 */
function derivePublicAccessFromContentAccess(access: ContentAccess): boolean {
  switch (access) {
    case ContentAccess.ViewPrivateEditPrivate:
    case ContentAccess.ViewTeamEditPrivate:
    case ContentAccess.ViewTeamEditTeam:
      return false;
    case ContentAccess.ViewPublicEditPrivate:
    case ContentAccess.ViewPublicEditTeam:
      return true;
  }
}

/**
 * Maps the two independent access dimensions to a ContentAccess enum value.
 * See the matrix in the Access Control section header above.
 */
function mapAccessValues(
  publicAccess: boolean,
  orgAccess: string,
): ContentAccess {
  switch (orgAccess) {
    case "viewer":
      return publicAccess
        ? ContentAccess.ViewPublicEditPrivate
        : ContentAccess.ViewTeamEditPrivate;
    case "editor":
      return publicAccess
        ? ContentAccess.ViewPublicEditTeam
        : ContentAccess.ViewTeamEditTeam;
    default: // "disabled" or unset
      if (publicAccess && orgAccess === "disabled") {
        logger.warn(
          "Organization access is not set, but public access is enabled - organization will have view access.",
        );
      }
      return publicAccess
        ? ContentAccess.ViewPublicEditPrivate
        : ContentAccess.ViewPrivateEditPrivate;
  }
}

/**
 * Determines the access control setting for first deploy.
 * If no access control config is provided, checks account entitlements to determine default.
 */
async function getAccessForFirstDeploy(
  api: ConnectCloudAPI,
  accountId: string,
  accessControl: ConnectCloudAccessControl | undefined,
): Promise<ContentAccess> {
  let publicAccess: boolean;
  let orgAccess = "";

  if (!accessControl || accessControl.publicAccess === undefined) {
    // No config specified — check account entitlements
    const account = await api.getAccount(accountId);
    const hasPrivateContent =
      account.license?.entitlements?.account_private_content_flag?.enabled ??
      false;
    publicAccess = !hasPrivateContent;
  } else {
    publicAccess = accessControl.publicAccess;
  }

  if (accessControl?.organizationAccess) {
    orgAccess = accessControl.organizationAccess;
  }

  return mapAccessValues(publicAccess, orgAccess);
}

/**
 * Determines the access control setting for redeploy.
 * If no access control config is provided, returns undefined (use server default).
 * If partial config is provided, fetches current access from server to merge.
 */
async function getAccessForRedeploy(
  api: ConnectCloudAPI,
  contentId: ContentID,
  accessControl: ConnectCloudAccessControl | undefined,
): Promise<ContentAccess | undefined> {
  if (!accessControl) {
    return undefined; // Use server default
  }

  const hasPublicAccess = accessControl.publicAccess !== undefined;
  const hasOrgAccess =
    accessControl.organizationAccess !== undefined &&
    accessControl.organizationAccess !== "";

  // Neither set → use server default
  if (!hasPublicAccess && !hasOrgAccess) {
    return undefined;
  }

  // Both set → use directly
  if (hasPublicAccess && hasOrgAccess) {
    return mapAccessValues(
      accessControl.publicAccess!,
      accessControl.organizationAccess!,
    );
  }

  // Partial config → fetch current access and merge
  const content = await api.getContent(contentId);

  if (hasPublicAccess) {
    // Only publicAccess set → derive orgAccess from server
    const orgAccess = deriveOrgAccessFromContentAccess(content.access);
    return mapAccessValues(accessControl.publicAccess!, orgAccess);
  } else {
    // Only orgAccess set → derive publicAccess from server
    const publicAccess = derivePublicAccessFromContentAccess(content.access);
    return mapAccessValues(publicAccess, accessControl.organizationAccess!);
  }
}

/**
 * Determines the access control setting based on whether this is a first deploy or redeploy.
 */
export function getAccess(
  api: ConnectCloudAPI,
  isFirstDeploy: boolean,
  accountId: string,
  contentId: ContentID | undefined,
  accessControl: ConnectCloudAccessControl | undefined,
): Promise<ContentAccess | undefined> {
  if (isFirstDeploy) {
    return getAccessForFirstDeploy(api, accountId, accessControl);
  } else {
    if (!contentId) {
      return Promise.reject(new Error("contentId required for redeploy"));
    }
    return getAccessForRedeploy(api, contentId, accessControl);
  }
}

// ---------------------------------------------------------------------------
// Runtime Options Mapping
// ---------------------------------------------------------------------------

/**
 * Maps ConnectRuntime config to Cloud ConnectOptions.
 */
function mapRuntimeToConnectOptions(
  runtime: ConnectRuntime,
): ConnectOptions | undefined {
  const hasAnyValue = Object.values(runtime).some((v) => v !== undefined);
  if (!hasAnyValue) {
    return undefined;
  }

  return {
    conn_timeout: runtime.connectionTimeout ?? undefined,
    read_timeout: runtime.readTimeout ?? undefined,
    init_timeout: runtime.initTimeout ?? undefined,
    idle_timeout: runtime.idleTimeout ?? undefined,
    sched_max_proc: runtime.maxProcesses ?? undefined,
    sched_min_proc: runtime.minProcesses ?? undefined,
    sched_max_conns: runtime.maxConnsPerProcess ?? undefined,
    sched_load_factor: runtime.loadFactor ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Content Request Building
// ---------------------------------------------------------------------------

/**
 * Builds a RequestRevision object from config.
 */
function buildRequestRevision(
  config: ConfigurationDetails,
  cloudContentType: CloudContentType,
): RequestRevision {
  const pythonVersion = config.python?.version ?? undefined;
  const connectOptions = config.connect?.runtime
    ? mapRuntimeToConnectOptions(config.connect.runtime)
    : undefined;

  return {
    source_type: "bundle",
    python_version: pythonVersion,
    content_type: cloudContentType,
    primary_file: config.entrypoint,
    connect_options: connectOptions,
  };
}

/**
 * Combines environment variables and secrets into Cloud Secret format.
 */
function buildSecrets(
  environment: Record<string, string> | undefined,
  secrets: Record<string, string> | undefined,
): Secret[] {
  const combined: Record<string, string> = {};
  if (environment) {
    Object.assign(combined, environment);
  }
  if (secrets) {
    Object.assign(combined, secrets);
  }

  return Object.entries(combined).map(([name, value]) => ({ name, value }));
}

/**
 * Builds ContentRequestBase fields shared by create and update requests.
 */
function buildContentRequestBase(
  config: ConfigurationDetails,
  saveName: string,
  secrets: Record<string, string> | undefined,
  isFirstDeploy: boolean,
  access: ContentAccess | undefined,
  cloudContentType: CloudContentType,
): ContentRequestBase {
  const title = config.title || saveName;
  const secretsArray = buildSecrets(config.environment, secrets);
  const revision = buildRequestRevision(config, cloudContentType);

  const base: ContentRequestBase = {
    title,
    description: config.description,
    access,
    secrets: secretsArray,
    vanity_name: config.connectCloud?.vanityName,
    content_type: cloudContentType,
  };

  if (isFirstDeploy) {
    base.next_revision = revision;
  } else {
    base.revision_overrides = revision;
  }

  return base;
}

/**
 * Builds a CreateContentRequest for first deploy.
 */
export function buildCreateContentRequest(
  config: ConfigurationDetails,
  saveName: string,
  secrets: Record<string, string> | undefined,
  accountId: string,
  access: ContentAccess,
): CreateContentRequest {
  const cloudContentType = cloudContentTypeFromPublisherType(config.type);
  const base = buildContentRequestBase(
    config,
    saveName,
    secrets,
    true,
    access,
    cloudContentType,
  );

  return {
    ...base,
    account_id: accountId,
  };
}

/**
 * Builds an UpdateContentRequest for redeploy.
 */
export function buildUpdateContentRequest(
  config: ConfigurationDetails,
  saveName: string,
  secrets: Record<string, string> | undefined,
  contentId: ContentID,
  access: ContentAccess | undefined,
): UpdateContentRequest {
  const cloudContentType = cloudContentTypeFromPublisherType(config.type);
  const base = buildContentRequestBase(
    config,
    saveName,
    secrets,
    false,
    access,
    cloudContentType,
  );

  return {
    ...base,
    content_id: contentId,
  };
}

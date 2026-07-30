// Copyright (C) 2026 by Posit Software, PBC.

export { discoverOAuthMetadata } from "./discovery";
export {
  OAuthClient,
  OAuthError,
  tokenExpiresAt,
  INVALID_CLIENT,
  AUTHORIZATION_PENDING,
  SLOW_DOWN,
  EXPIRED_TOKEN,
  ACCESS_DENIED,
} from "./client";
export type { DevicePollResult } from "./client";
export { ConnectOAuthActivator } from "./activator";
export type { OAuthAuthResult } from "./activator";
export { generatePkcePair, generateState } from "./pkce";
export { startLoopbackServer } from "./loopback";
export type { LoopbackHandle } from "./loopback";
export {
  detectWorkbench,
  isWorkbenchRelayReachable,
  pollWorkbenchAuthCode,
  workbenchRedirectUri,
  WorkbenchRelayError,
} from "./workbench";
export type { WorkbenchEnvironment } from "./workbench";
export * from "./types";

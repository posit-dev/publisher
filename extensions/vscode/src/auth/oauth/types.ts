// Copyright (C) 2026 by Posit Software, PBC.

/**
 * OAuth 2.0 authorization-server metadata (RFC 8414), as advertised by Connect
 * at `/.well-known/oauth-authorization-server`. Only the fields Publisher uses
 * are typed; the document may contain more.
 */
export interface OAuthMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  device_authorization_endpoint?: string;
  revocation_endpoint?: string;
  response_types_supported?: string[];
  grant_types_supported?: string[];
  code_challenge_methods_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
}

/** Dynamic client registration response (RFC 7591). */
export interface ClientRegistration {
  client_id: string;
  client_name?: string;
  redirect_uris?: string[];
  client_id_issued_at?: number;
}

/** Token endpoint success response (RFC 6749 §5.1). */
export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

/** Device authorization response (RFC 8628 §3.2). */
export interface DeviceAuthResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval?: number;
}

/** The tokens + client id Publisher persists for an OAuth credential. */
export interface OAuthTokens {
  oauthClientId: string;
  accessToken: string;
  refreshToken: string;
  /** ISO-8601 timestamp when the access token expires, or "" if unknown. */
  tokenExpiresAt: string;
}

/** PKCE code verifier + S256 challenge pair (RFC 7636). */
export interface PkcePair {
  verifier: string;
  challenge: string;
}

/**
 * The client name registered with Connect's OAuth server via dynamic client
 * registration. Matches rsconnect-python's convention of a stable, descriptive
 * client name.
 */
export const OAUTH_CLIENT_NAME = "posit-publisher";

/**
 * The redirect URI registered with Connect (loopback, no explicit port).
 * Connect accepts any loopback redirect URI and matches it against the actual
 * authorize/callback URI ignoring the port (RFC 8252), so the ephemeral
 * loopback-server port does not need to be known at registration time. Mirrors
 * rsconnect-python's `http://127.0.0.1/callback`.
 */
export const OAUTH_LOOPBACK_REDIRECT = "http://127.0.0.1/callback";

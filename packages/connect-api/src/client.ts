// Copyright (C) 2026 by Posit Software, PBC.

import https from "https";
import { Readable } from "stream";
import type { ClientRequest, IncomingMessage } from "http";
import axios from "axios";
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

import { md5Checksum, signRequestWithChecksum } from "./auth.js";
import { attachRedirectHandling } from "./redirects.js";
import type {
  AllSettings,
  ApplicationSettings,
  BundleDTO,
  BundleID,
  ConnectAPIOptions,
  ConnectContent,
  ContentDetailsDTO,
  ContentID,
  DeployOutput,
  Integration,
  NodejsInfo,
  PyInfo,
  QuartoInfo,
  RInfo,
  SchedulerSettings,
  ServerSettings,
  TaskDTO,
  TaskID,
  User,
  UserDTO,
} from "./types.js";

/**
 * Error thrown by ConnectAPI methods when an HTTP error occurs.
 * Preserves the HTTP status code for callers to inspect.
 */
export class ConnectAPIError extends Error {
  constructor(
    message: string,
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "ConnectAPIError";
  }
}

/**
 * Known Connect app modes that have app-specific scheduler settings
 * (excluding "static" which has no scheduler settings). Unknown strings
 * fall back to the base /server_settings/scheduler endpoint.
 */
const knownAppModes = new Set([
  "jupyter-static",
  "jupyter-voila",
  "nodejs",
  "python-bokeh",
  "python-dash",
  "python-fastapi",
  "python-api",
  "python-shiny",
  "python-streamlit",
  "python-gradio",
  "python-panel",
  "quarto-shiny",
  "quarto-static",
  "api",
  "shiny",
  "rmd-shiny",
  "rmd-static",
]);

/**
 * TypeScript client for the Posit Connect API.
 *
 * Uses axios for HTTP requests. Non-2xx responses throw AxiosError by default.
 * Property names use snake_case to match the Connect API JSON wire format.
 */
export class ConnectAPI {
  private readonly client: AxiosInstance;

  constructor(options: ConnectAPIOptions) {
    const hasApiKey = !!options.apiKey;
    const hasToken = !!options.token && !!options.privateKey;
    const hasSnowflake = !!options.snowflakeToken;

    // Allow no credentials (for URL reachability checks), but reject
    // partial token auth (token without privateKey or vice versa).
    if (!hasApiKey && !hasToken && (options.token || options.privateKey)) {
      throw new Error(
        "ConnectAPI requires both token and privateKey for token authentication",
      );
    }

    // The whole client stays on axios's native http/https transport
    // (`maxRedirects: 0`), which truly streams request bodies rather than
    // buffering them to replay on a redirect. Redirects are instead followed
    // manually by `attachRedirectHandling` below, which re-issues each hop
    // through this instance so token-auth signing and cookie forwarding rerun.
    const config: AxiosRequestConfig = {
      baseURL: options.url,
      maxRedirects: 0,
    };

    if (hasSnowflake) {
      config.headers = {
        Authorization: `Snowflake Token="${options.snowflakeToken}"`,
      };
      if (hasApiKey) {
        config.headers["X-RSC-Authorization"] = `Key ${options.apiKey}`;
      }
    } else if (hasApiKey) {
      config.headers = {
        Authorization: `Key ${options.apiKey}`,
      };
    }

    // Support disabling TLS certificate verification (for self-signed certs).
    if (options.rejectUnauthorized === false) {
      config.httpsAgent = new https.Agent({ rejectUnauthorized: false });
      // VS Code's proxy support (the `http.proxySupport` setting, "override"
      // by default) patches Node's https module in the extension host and
      // discards the `rejectUnauthorized` option configured on a custom Agent,
      // so the httpsAgent above is not enough on its own. The patch does
      // honour `rejectUnauthorized` when it is set on the per-request options,
      // so we route requests through a transport that injects it. This
      // transport does not follow redirects, which is acceptable for the
      // misconfigured servers where a user has explicitly disabled verification.
      config.transport = {
        request: (
          reqOptions: https.RequestOptions,
          callback: (res: IncomingMessage) => void,
        ): ClientRequest =>
          https.request({ ...reqOptions, rejectUnauthorized: false }, callback),
      };
    }

    if (options.timeout !== undefined) {
      config.timeout = options.timeout;
    }

    this.client = axios.create(config);

    // Follow redirects manually (see the config comment above). Registered
    // before the token/cookie interceptors: the cookie-capture response
    // interceptor has no rejected handler, so 3xx rejections flow past it into
    // this handler regardless of ordering, and request interceptors re-run on
    // each re-issued hop either way.
    attachRedirectHandling(this.client);

    // For token auth, add a request interceptor that computes per-request signing headers
    if (hasToken) {
      const token = options.token!;
      const privateKey = options.privateKey!;

      this.client.interceptors.request.use((reqConfig) => {
        const method = (reqConfig.method ?? "GET").toUpperCase();
        // Extract the path from the url (which is relative to baseURL).
        // After a redirect the re-issued request carries an absolute URL; the
        // signature covers only the path, matching what we sign for relative
        // URLs (the query never participates — getTaskLogs' params are unsigned
        // today).
        const rawUrl = reqConfig.url ?? "/";
        const path = /^https?:\/\//i.test(rawUrl)
          ? new URL(rawUrl).pathname
          : rawUrl;

        // The signature covers a base64 MD5 of the exact bytes Connect
        // receives. Streamed bodies (large bundle uploads) can't be hashed
        // here, so the caller must precompute the checksum and pass it as the
        // X-Content-Checksum header; we sign that value. For in-memory bodies
        // we hash directly — using raw bytes for Buffer/Uint8Array (bundle
        // uploads), since JSON.stringify on a Uint8Array produces
        // {"0":31,"1":139,...} which is wrong.
        let checksum: string;
        const data = reqConfig.data;
        if (data instanceof Readable) {
          const provided = reqConfig.headers.get("X-Content-Checksum");
          if (typeof provided !== "string") {
            throw new Error(
              "Streamed request body requires a precomputed X-Content-Checksum header",
            );
          }
          checksum = provided;
        } else {
          const body: string | Buffer | Uint8Array | undefined =
            data == null
              ? undefined
              : Buffer.isBuffer(data) || data instanceof Uint8Array
                ? data
                : JSON.stringify(data);
          checksum = md5Checksum(body);
        }

        const headers = signRequestWithChecksum(
          method,
          path,
          checksum,
          token,
          privateKey,
        );
        for (const [key, value] of Object.entries(headers)) {
          reqConfig.headers.set(key, value);
        }
        return reqConfig;
      });
    }

    // Cookie jar for session affinity in HA environments.
    // Load balancers set cookies to pin requests to a backend node;
    // without forwarding them, polling requests (e.g. waitForTask) can
    // land on different nodes and get spurious 404s.
    let cookies: string[] = [];

    this.client.interceptors.response.use((response) => {
      const setCookie = response.headers["set-cookie"];
      if (setCookie) {
        cookies = setCookie;
      }
      return response;
    });

    this.client.interceptors.request.use((config) => {
      if (cookies.length > 0) {
        config.headers["Cookie"] = cookies.join("; ");
      }
      return config;
    });
  }

  /**
   * Validates credentials and checks user state (locked, confirmed, role).
   * Returns { user, error: null } on success; throws on HTTP errors or invalid state.
   *
   * When the client is constructed without credentials (for URL reachability
   * checks), this method will throw a {@link ConnectAPIError} with
   * `httpStatus: 401`. Callers should handle that case explicitly.
   */
  async testAuthentication(
    signal?: AbortSignal,
  ): Promise<{ user: User; error: null }> {
    let data: UserDTO;
    try {
      ({ data } = await this.client.get<UserDTO>("/__api__/v1/user", {
        signal,
      }));
    } catch (err) {
      // Let cancellation errors propagate without wrapping, so callers
      // can distinguish abort from real API failures.
      if (axios.isCancel(err)) {
        throw err;
      }
      if (axios.isAxiosError(err)) {
        // No response at all — a connection-level failure.
        if (!err.response) {
          // TLS/certificate errors: rethrow as-is so callers can identify
          // them (e.g. testCredentials classifies them as
          // errorCertificateVerification).
          if (isCertificateError(err)) {
            throw err;
          }
          // Other network errors (DNS failure, VPN disconnected, etc.)
          throw new ConnectAPIError(
            "Unable to reach the server. " +
              "Check your network connection, VPN, and server URL.",
          );
        }
        const errorBody = err.response.data;
        const msg =
          typeof errorBody?.error === "string"
            ? errorBody.error
            : `HTTP ${err.response.status}`;
        throw new ConnectAPIError(msg, err.response.status);
      }
      throw err;
    }

    // Guard against non-JSON responses (e.g., an auth proxy returning HTML).
    // Axios returns the raw string when content-type isn't JSON, so `data`
    // would be a string instead of an object.
    if (typeof data !== "object" || data === null || !("guid" in data)) {
      throw new ConnectAPIError(
        "The server did not return a valid JSON response. " +
          "Check the server URL and credentials.",
        undefined,
      );
    }

    // TODO: These business-logic errors throw plain Error while HTTP errors
    // throw ConnectAPIError. Consider using a typed error (e.g. ConnectAPIError
    // or a dedicated subclass) for consistency with catch-by-type patterns.
    if (data.locked) {
      throw new Error(`user account ${data.username} is locked`);
    }

    if (!data.confirmed) {
      throw new Error(`user account ${data.username} is not confirmed`);
    }

    if (data.user_role !== "publisher" && data.user_role !== "administrator") {
      throw new Error(
        `user account ${data.username} with role '${data.user_role}' does not have permission to publish content`,
      );
    }

    return {
      user: {
        id: data.guid,
        username: data.username,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
      },
      error: null,
    };
  }

  /** Retrieves the current authenticated user without validation checks. */
  async getCurrentUser(signal?: AbortSignal): Promise<User> {
    const { data } = await this.client.get<UserDTO>("/__api__/v1/user", {
      signal,
    });
    return {
      id: data.guid,
      username: data.username,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
    };
  }

  /** Fetches details for a content item by ID. */
  async contentDetails(
    contentId: ContentID,
    signal?: AbortSignal,
  ): Promise<AxiosResponse<ContentDetailsDTO>> {
    return this.client.get<ContentDetailsDTO>(
      `/__api__/v1/content/${contentId}`,
      { signal },
    );
  }

  /** Creates a new content item and returns the full content details. */
  async createDeployment(
    body: ConnectContent,
    signal?: AbortSignal,
  ): Promise<AxiosResponse<ContentDetailsDTO>> {
    return this.client.post<ContentDetailsDTO>("/__api__/v1/content", body, {
      signal,
    });
  }

  /** Updates an existing content item. */
  async updateDeployment(
    contentId: ContentID,
    body: ConnectContent,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.client.patch(`/__api__/v1/content/${contentId}`, body, {
      signal,
    });
  }

  /** Retrieves environment variable names for a content item. */
  async getEnvVars(
    contentId: ContentID,
    signal?: AbortSignal,
  ): Promise<AxiosResponse<string[]>> {
    return this.client.get<string[]>(
      `/__api__/v1/content/${contentId}/environment`,
      { signal },
    );
  }

  /** Sets environment variables for a content item. */
  async setEnvVars(
    contentId: ContentID,
    env: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.client.patch(
      `/__api__/v1/content/${contentId}/environment`,
      Object.entries(env).map(([name, value]) => ({ name, value })),
      { signal },
    );
  }

  /**
   * Uploads a bundle archive (gzip) for a content item.
   *
   * The body is streamed from the staged bundle file so uploads of arbitrary
   * size never have to be buffered in memory. `contentLength` and `checksum`
   * are already known from writing that temp file to disk — `contentLength` is
   * its byte size and `checksum` is the base64 MD5 of its contents — so we pass
   * both here rather than have axios try to derive them from the stream.
   * `checksum` is sent as X-Content-Checksum so token-auth request signing can
   * cover the body without re-reading it.
   *
   * `makeBody` is a factory that opens a fresh read stream from the bundle file
   * on disk. A stream can only be consumed once, so on each redirect hop the
   * redirect handler destroys the consumed stream and calls the factory again
   * for a new one — the bundle is re-streamed from disk, never buffered in
   * memory. `Content-Length` and `X-Content-Checksum` are constant across hops
   * (the file on disk does not change) and ride on the request headers; the
   * token-auth interceptor re-signs each redirect target's path against that
   * same precomputed checksum. `Date` and `X-Auth-*` are recomputed per hop.
   */
  async uploadBundle(
    contentId: ContentID,
    makeBody: () => Readable,
    contentLength: number,
    checksum: string,
    signal?: AbortSignal,
  ): Promise<AxiosResponse<BundleDTO>> {
    // Track the live stream so each redirect hop can destroy the consumed
    // one before opening a fresh read from disk, and so the final stream is
    // always cleaned up even when the request fails or is aborted.
    let current: Readable | undefined;
    const bodyFactory = (): Readable => {
      current?.destroy();
      current = makeBody();
      return current;
    };
    try {
      return await this.client.post<BundleDTO>(
        `/__api__/v1/content/${contentId}/bundles`,
        bodyFactory(),
        {
          headers: {
            "Content-Type": "application/gzip",
            "Content-Length": contentLength,
            "X-Content-Checksum": checksum,
          },
          bodyFactory,
          signal,
        },
      );
    } finally {
      // On success the stream is fully consumed; destroy() is then a no-op.
      current?.destroy();
    }
  }

  /** Downloads a bundle archive as raw bytes. */
  async downloadBundle(
    contentId: ContentID,
    bundleId: BundleID,
    signal?: AbortSignal,
  ): Promise<Uint8Array> {
    const { data } = await this.client.get<ArrayBuffer>(
      `/__api__/v1/content/${contentId}/bundles/${bundleId}/download`,
      { responseType: "arraybuffer", signal },
    );
    return new Uint8Array(data);
  }

  /** Initiates deployment of a specific bundle. */
  async deployBundle(
    contentId: ContentID,
    bundleId: BundleID,
    signal?: AbortSignal,
  ): Promise<AxiosResponse<DeployOutput>> {
    return this.client.post<DeployOutput>(
      `/__api__/v1/content/${contentId}/deploy`,
      { bundle_id: bundleId },
      { signal },
    );
  }

  /**
   * Polls for task completion.
   * @param pollIntervalMs - milliseconds between polls (default 500, pass 0 for tests)
   * @param onOutput - optional callback invoked with each batch of new log lines as they arrive
   * @param signal - optional abort signal to cancel polling
   */
  async waitForTask(
    taskId: TaskID,
    pollIntervalMs = 500,
    onOutput?: (lines: string[]) => void,
    signal?: AbortSignal,
  ): Promise<TaskDTO> {
    let firstLine = 0;

    while (true) {
      signal?.throwIfAborted();

      const { data: task } = await this.client.get<TaskDTO>(
        `/__api__/v1/tasks/${taskId}`,
        { params: { first: firstLine }, signal },
      );

      if (onOutput && task.output.length > 0) {
        onOutput(task.output);
      }

      if (task.finished) {
        if (task.error) {
          throw new Error(task.error);
        }
        return task;
      }

      firstLine = task.last;

      if (pollIntervalMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    }
  }

  /**
   * Validates that deployed content is reachable by hitting its content URL.
   * Status >= 500 throws; 404 and other codes are acceptable.
   */
  async validateDeployment(
    contentId: ContentID,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.client.get(`/content/${contentId}/`, {
      validateStatus: (status: number) => status < 500,
      signal,
    });
  }

  /**
   * Registers a new authentication token with Connect.
   * This is a public endpoint — no credentials are required.
   * The user must then visit the returned claim URL to associate the token
   * with their account.
   */
  async registerToken(
    token: string,
    publicKey: string,
  ): Promise<{ token_claim_url: string }> {
    const { data } = await this.client.post<{ token_claim_url: string }>(
      "/__api__/tokens",
      {
        token,
        public_key: publicKey,
        user_id: 0,
      },
    );
    return data;
  }

  /** Retrieves OAuth integrations from the server. */
  async getIntegrations(
    signal?: AbortSignal,
  ): Promise<AxiosResponse<Integration[]>> {
    return this.client.get<Integration[]>("/__api__/v1/oauth/integrations", {
      signal,
    });
  }

  /**
   * Fetches composite server settings from 8 separate endpoints.
   *
   * The Node.js settings endpoint (`/v1/server_settings/nodejs`) returns a
   * 404 on older Connect servers that predate Connect 2026.04.0; in
   * that case `getSettings` falls back to `{ installations: [], enabled: false }`
   * rather than failing the entire call. Any other error (network failure,
   * 5xx, auth) on the Node.js request still fails `getSettings` — only 404
   * is swallowed.
   *
   * @param appMode - Connect app mode string (e.g. "python-shiny", "static").
   *   When provided and not "static", the scheduler endpoint is fetched with
   *   an app-mode-specific path (`/scheduler/{appMode}`) to get limits that
   *   apply to that content type. The app-mode path is skipped for static and
   *   unknown content types.
   * @param signal - optional abort signal to cancel all settings requests
   */
  async getSettings(
    appMode?: string,
    signal?: AbortSignal,
  ): Promise<AllSettings> {
    // Use the app-mode-specific scheduler path for known, non-static types.
    // "static" content has no scheduler settings; unknown types would produce
    // invalid API paths.
    const schedulerPath =
      appMode && knownAppModes.has(appMode)
        ? `/__api__/server_settings/scheduler/${appMode}`
        : "/__api__/server_settings/scheduler";

    const [
      { data: user },
      { data: general },
      { data: application },
      { data: scheduler },
      { data: python },
      { data: r },
      { data: quarto },
      { data: nodejs },
    ] = await Promise.all([
      this.client.get<UserDTO>("/__api__/v1/user", { signal }),
      this.client.get<ServerSettings>("/__api__/server_settings", { signal }),
      this.client.get<ApplicationSettings>(
        "/__api__/server_settings/applications",
        { signal },
      ),
      this.client.get<SchedulerSettings>(schedulerPath, { signal }),
      this.client.get<PyInfo>("/__api__/v1/server_settings/python", { signal }),
      this.client.get<RInfo>("/__api__/v1/server_settings/r", { signal }),
      this.client.get<QuartoInfo>("/__api__/v1/server_settings/quarto", {
        signal,
      }),
      this.client
        .get<NodejsInfo>("/__api__/v1/server_settings/nodejs", { signal })
        .catch((err): { data: NodejsInfo } => {
          if (axios.isAxiosError(err) && err.response?.status === 404) {
            return { data: { installations: [], enabled: false } };
          }
          throw err;
        }),
    ]);

    return { general, user, application, scheduler, python, r, quarto, nodejs };
  }
}

/** Detect TLS/certificate errors from axios error codes. */
export function isCertificateError(err: { code?: string }): boolean {
  const certCodes = [
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "DEPTH_ZERO_SELF_SIGNED_CERT",
    "SELF_SIGNED_CERT_IN_CHAIN",
    "ERR_TLS_CERT_ALTNAME_INVALID",
    "CERT_HAS_EXPIRED",
    // "signed by unknown authority": the issuing CA is not in the trust
    // store. Common behind internal/corporate CAs and TLS-intercepting proxies.
    "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
    "UNABLE_TO_GET_ISSUER_CERT",
    "CERT_UNTRUSTED",
  ];
  return !!err.code && certCodes.includes(err.code);
}

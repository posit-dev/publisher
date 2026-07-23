// Copyright (C) 2026 by Posit Software, PBC.

import crypto from "crypto";
import { Readable } from "stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectAPI } from "./client.js";
import { MAX_REDIRECTS } from "./redirects.js";
import { buildCanonicalRequest, rsaSha1Sign } from "./auth.js";
import { ContentID, BundleID, TaskID } from "./types.js";
import type { UserDTO, ContentDetailsDTO } from "./types.js";

// ---------------------------------------------------------------------------
// Mock axios — simulates real axios throw behavior on non-2xx
// ---------------------------------------------------------------------------

const mockRequest = vi.fn();

vi.mock("axios", () => {
  type Cfg = Record<string, unknown>;
  type Resp = { status: number; headers?: Record<string, unknown> } & Record<
    string,
    unknown
  >;
  type Fulfilled = (value: Cfg) => Cfg;
  type ResFulfilled = (resp: Resp) => Resp | Promise<Resp>;
  type ResRejected = (error: unknown) => unknown;

  // Request interceptors are onFulfilled-only in our client.
  function createRequestManager() {
    const handlers: Fulfilled[] = [];
    return {
      use: (fn: Fulfilled) => {
        handlers.push(fn);
      },
      _handlers: handlers,
    };
  }

  // Response interceptors store (onFulfilled, onRejected) pairs so the
  // redirect handler's rejected handler runs and can recover by returning a
  // new request promise, just like real axios.
  function createResponseManager() {
    const handlers: Array<{
      onFulfilled?: ResFulfilled;
      onRejected?: ResRejected;
    }> = [];
    return {
      use: (onFulfilled?: ResFulfilled, onRejected?: ResRejected) => {
        handlers.push({ onFulfilled, onRejected });
      },
      _handlers: handlers,
    };
  }

  const defaultValidate = (s: number) => s >= 200 && s < 300;

  return {
    default: {
      create: vi.fn((createConfig: Cfg = {}) => {
        const reqInterceptors = createRequestManager();
        const resInterceptors = createResponseManager();
        const instanceHeaders = (createConfig.headers ?? {}) as Record<
          string,
          unknown
        >;

        // Runs the request and applies validateStatus. Resolves the response
        // on success; on a non-2xx status rejects with an AxiosError that
        // carries `config` (like real axios) so the redirect handler can
        // re-issue it.
        async function dispatch(cfg: Cfg): Promise<Resp> {
          const resp: Resp = await mockRequest(cfg);
          const validate =
            (cfg.validateStatus as ((s: number) => boolean) | undefined) ??
            defaultValidate;
          if (!validate(resp.status)) {
            return Promise.reject(
              Object.assign(
                new Error(`Request failed with status code ${resp.status}`),
                { isAxiosError: true, response: resp, config: cfg },
              ),
            );
          }
          return resp;
        }

        async function request(config: Cfg): Promise<Resp> {
          // Add a mock headers object with .set() to simulate AxiosHeaders.
          // Instance default headers merge under per-request headers.
          const headerStore: Record<string, string> = {};
          const baseHeaders: Record<string, unknown> = {
            ...instanceHeaders,
            ...((config.headers ?? {}) as Record<string, unknown>),
          };
          const headers: Record<string, unknown> = {
            ...baseHeaders,
            set: (key: string, value: string) => {
              headerStore[key] = value;
            },
            get: (key: string) => {
              const stored = headerStore[key];
              if (typeof stored === "string") {
                return stored;
              }
              const base = baseHeaders[key];
              return typeof base === "string" ? base : undefined;
            },
          };

          // Instance defaults (baseURL, maxRedirects) merge under the
          // per-request config, matching real axios mergeConfig behavior.
          let cfg: Cfg = {
            baseURL: createConfig.baseURL,
            maxRedirects: createConfig.maxRedirects,
            ...config,
            headers,
          };

          // Apply request interceptors
          for (const handler of reqInterceptors._handlers) {
            cfg = handler(cfg);
          }

          // Merge headerStore into cfg so tests can inspect signed headers
          if (Object.keys(headerStore).length > 0) {
            cfg._signedHeaders = headerStore;
          }

          // Dispatch, then run the response interceptor chain in registration
          // order. An onRejected handler may recover by returning a promise
          // (the redirect handler returns instance.request(...)).
          let result: Promise<Resp> = dispatch(cfg);
          for (const { onFulfilled, onRejected } of resInterceptors._handlers) {
            result = result.then(
              onFulfilled ?? ((r: Resp) => r),
              onRejected,
            ) as Promise<Resp>;
          }
          return result;
        }

        const instance = {
          request,
          get: (url: string, config?: Cfg) =>
            request({ method: "GET", url, ...config }),
          post: (url: string, data?: unknown, config?: Cfg) =>
            request({ method: "POST", url, data, ...config }),
          patch: (url: string, data?: unknown, config?: Cfg) =>
            request({ method: "PATCH", url, data, ...config }),
          interceptors: {
            request: reqInterceptors,
            response: resInterceptors,
          },
        };
        return instance;
      }),
      isAxiosError: (err: unknown): boolean =>
        typeof err === "object" &&
        err !== null &&
        (err as Record<string, unknown>).isAxiosError === true,
      isCancel: (err: unknown): boolean =>
        typeof err === "object" &&
        err !== null &&
        (err as Record<string, unknown>).__CANCEL__ === true,
    },
  };
});

// Re-import axios so we can inspect axios.create calls
import axios from "axios";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = "https://connect.example.com";
const API_KEY = "test-api-key-123";

function createClient(): ConnectAPI {
  return new ConnectAPI({ url: BASE_URL, apiKey: API_KEY });
}

function jsonResponse(
  body: unknown,
  status = 200,
  statusText = "OK",
  headers: Record<string, string> = { "content-type": "application/json" },
): {
  status: number;
  statusText: string;
  data: unknown;
  headers: Record<string, string>;
  config: object;
} {
  return {
    status,
    statusText,
    data: body,
    headers,
    config: {},
  };
}

function textResponse(
  body: string,
  status = 200,
  statusText = "OK",
  headers: Record<string, string> = {},
): {
  status: number;
  statusText: string;
  data: string;
  headers: Record<string, string>;
  config: object;
} {
  return {
    status,
    statusText,
    data: body,
    headers,
    config: {},
  };
}

/**
 * A 3xx redirect response. `location` is lower-cased to match how Node and
 * AxiosHeaders normalize the header the redirect handler reads.
 */
function redirectResponse(
  status: number,
  location?: string,
): {
  status: number;
  statusText: string;
  data: unknown;
  headers: Record<string, string>;
  config: object;
} {
  return {
    status,
    statusText: "Redirect",
    data: "",
    headers: location !== undefined ? { location } : {},
    config: {},
  };
}

function binaryResponse(
  data: Uint8Array,
  status = 200,
): {
  status: number;
  statusText: string;
  data: ArrayBuffer;
  headers: Record<string, string>;
  config: object;
} {
  const buffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  ) as ArrayBuffer;
  return {
    status,
    statusText: "OK",
    data: buffer,
    headers: {},
    config: {},
  };
}

/** A valid publisher UserDTO for reuse across tests. */
function validUserDTO(overrides?: Partial<UserDTO>): UserDTO {
  return {
    guid: "user-guid-123",
    username: "publisher1",
    first_name: "Test",
    last_name: "User",
    email: "test@example.com",
    user_role: "publisher",
    created_time: "2024-01-01T00:00:00Z",
    updated_time: "2024-01-01T00:00:00Z",
    active_time: null,
    confirmed: true,
    locked: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

afterEach(() => {
  vi.restoreAllMocks();
  mockRequest.mockReset();
});

// ---------------------------------------------------------------------------
// Cross-cutting: Authorization header
// ---------------------------------------------------------------------------

describe("Authorization header", () => {
  it("sends Authorization: Key <apiKey> on every request", async () => {
    mockRequest.mockResolvedValue(jsonResponse(validUserDTO()));

    const client = createClient();
    await client.getCurrentUser();

    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: BASE_URL,
        headers: expect.objectContaining({
          Authorization: `Key ${API_KEY}`,
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// TLS certificate verification
// ---------------------------------------------------------------------------

describe("TLS certificate verification", () => {
  it("does not set httpsAgent when rejectUnauthorized is not specified", () => {
    new ConnectAPI({ url: BASE_URL, apiKey: API_KEY });

    const call = vi.mocked(axios.create).mock.calls.at(-1)?.[0];
    expect(call?.httpsAgent).toBeUndefined();
  });

  it("does not set httpsAgent when rejectUnauthorized is true", () => {
    new ConnectAPI({
      url: BASE_URL,
      apiKey: API_KEY,
      rejectUnauthorized: true,
    });

    const call = vi.mocked(axios.create).mock.calls.at(-1)?.[0];
    expect(call?.httpsAgent).toBeUndefined();
  });

  it("sets httpsAgent with rejectUnauthorized: false when option is false", () => {
    new ConnectAPI({
      url: BASE_URL,
      apiKey: API_KEY,
      rejectUnauthorized: false,
    });

    const call = vi.mocked(axios.create).mock.calls.at(-1)?.[0];
    expect(call?.httpsAgent).toBeDefined();
    expect(call?.httpsAgent?.options?.rejectUnauthorized).toBe(false);
  });

  it("installs a transport injecting rejectUnauthorized:false when option is false", () => {
    // A custom Agent's rejectUnauthorized is ignored by VS Code's proxy
    // patch; the per-request transport is what actually disables verification.
    new ConnectAPI({
      url: BASE_URL,
      apiKey: API_KEY,
      rejectUnauthorized: false,
    });

    // `transport` is typed `any` on the axios config; no cast needed.
    const call = vi.mocked(axios.create).mock.calls.at(-1)?.[0];
    expect(typeof call?.transport?.request).toBe("function");
  });

  it("does not install a custom transport when verification is enabled", () => {
    new ConnectAPI({ url: BASE_URL, apiKey: API_KEY });

    const call = vi.mocked(axios.create).mock.calls.at(-1)?.[0];
    expect(call?.transport).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Timeout option
// ---------------------------------------------------------------------------

describe("timeout option", () => {
  it("passes timeout when specified", () => {
    new ConnectAPI({ url: BASE_URL, apiKey: API_KEY, timeout: 5000 });

    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 5000 }),
    );
  });

  it("does not pass timeout when omitted", () => {
    new ConnectAPI({ url: BASE_URL, apiKey: API_KEY });

    const call = vi.mocked(axios.create).mock.calls.at(-1)?.[0];
    expect(call?.timeout).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// testAuthentication
// ---------------------------------------------------------------------------

describe("testAuthentication", () => {
  it("returns { user, error: null } with mapped User on success", async () => {
    const dto = validUserDTO();
    mockRequest.mockResolvedValue(jsonResponse(dto));

    const client = createClient();
    const result = await client.testAuthentication();

    expect(result).toEqual({
      user: {
        id: dto.guid,
        username: dto.username,
        first_name: dto.first_name,
        last_name: dto.last_name,
        email: dto.email,
      },
      error: null,
    });
  });

  it("throws on 401", async () => {
    mockRequest.mockResolvedValue(
      jsonResponse({ error: "Unauthorized" }, 401, "Unauthorized"),
    );

    const client = createClient();
    await expect(client.testAuthentication()).rejects.toThrow("Unauthorized");
  });

  it("throws when user is locked", async () => {
    const dto = validUserDTO({ locked: true });
    mockRequest.mockResolvedValue(jsonResponse(dto));

    const client = createClient();
    await expect(client.testAuthentication()).rejects.toThrow(
      /user account publisher1 is locked/,
    );
  });

  it("throws when user is not confirmed", async () => {
    const dto = validUserDTO({ confirmed: false });
    mockRequest.mockResolvedValue(jsonResponse(dto));

    const client = createClient();
    await expect(client.testAuthentication()).rejects.toThrow(
      /user account publisher1 is not confirmed/,
    );
  });

  it("throws when user is a viewer", async () => {
    const dto = validUserDTO({ user_role: "viewer" });
    mockRequest.mockResolvedValue(jsonResponse(dto));

    const client = createClient();
    await expect(client.testAuthentication()).rejects.toThrow(
      /does not have permission to publish content/,
    );
  });

  it("accepts administrator role", async () => {
    const dto = validUserDTO({ user_role: "administrator" });
    mockRequest.mockResolvedValue(jsonResponse(dto));

    const client = createClient();
    const result = await client.testAuthentication();
    expect(result.user.id).toBe(dto.guid);
    expect(result.error).toBeNull();
  });

  it("throws with generic message on non-JSON error body", async () => {
    mockRequest.mockResolvedValue(textResponse("not json", 403, "Forbidden"));

    const client = createClient();
    await expect(client.testAuthentication()).rejects.toThrow("HTTP 403");
  });

  it("throws clear network error when server is unreachable (no response)", async () => {
    // Simulate a network error (e.g. VPN disconnected, DNS failure) —
    // axios throws an AxiosError with no `response` property.
    const networkErr = Object.assign(new Error("connect ECONNREFUSED"), {
      isAxiosError: true,
      code: "ECONNREFUSED",
      // No `response` — this is what triggers "HTTP undefined" without the fix
    });
    mockRequest.mockRejectedValue(networkErr);

    const client = createClient();
    await expect(client.testAuthentication()).rejects.toThrow(
      /Unable to reach the server/,
    );
  });

  it("network error throws ConnectAPIError with no httpStatus", async () => {
    const { ConnectAPIError } = await import("./client.js");
    const networkErr = Object.assign(new Error("Network Error"), {
      isAxiosError: true,
      code: "ERR_NETWORK",
    });
    mockRequest.mockRejectedValue(networkErr);

    const client = createClient();
    try {
      await client.testAuthentication();
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ConnectAPIError);
      expect(
        (err as InstanceType<typeof ConnectAPIError>).httpStatus,
      ).toBeUndefined();
    }
  });

  it.each([
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "DEPTH_ZERO_SELF_SIGNED_CERT",
    "SELF_SIGNED_CERT_IN_CHAIN",
    "ERR_TLS_CERT_ALTNAME_INVALID",
    "CERT_HAS_EXPIRED",
    "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
    "UNABLE_TO_GET_ISSUER_CERT",
    "CERT_UNTRUSTED",
  ])("certificate error (%s) is not wrapped as network error", async (code) => {
    // TLS/certificate errors also have no `response`, but they should NOT
    // be caught by the network-error check — callers need the original
    // error code to classify them as certificate verification failures.
    const certErr = Object.assign(new Error(`cert error: ${code}`), {
      isAxiosError: true,
      code,
    });
    mockRequest.mockRejectedValue(certErr);

    const client = createClient();
    // The original error is rethrown as-is (not wrapped in ConnectAPIError)
    // so callers can inspect the error code for certificate classification.
    await expect(client.testAuthentication()).rejects.toThrow(
      `cert error: ${code}`,
    );
  });

  it("throws clear error when auth proxy returns HTML on 200", async () => {
    // An authenticating proxy may return a 200 with an HTML login page
    // instead of a JSON user object. The guard should catch this.
    mockRequest.mockResolvedValue(
      textResponse("<html><body>Login required</body></html>"),
    );

    const client = createClient();
    await expect(client.testAuthentication()).rejects.toThrow(
      /did not return a valid JSON response/,
    );
  });
});

// ---------------------------------------------------------------------------
// getCurrentUser
// ---------------------------------------------------------------------------

describe("getCurrentUser", () => {
  it("maps UserDTO to simplified User with id from guid", async () => {
    const dto = validUserDTO();
    mockRequest.mockResolvedValue(jsonResponse(dto));

    const client = createClient();
    const user = await client.getCurrentUser();

    expect(user).toEqual({
      id: dto.guid,
      username: dto.username,
      first_name: dto.first_name,
      last_name: dto.last_name,
      email: dto.email,
    });
  });

  it("throws on non-2xx", async () => {
    mockRequest.mockResolvedValue(
      textResponse("err", 500, "Internal Server Error"),
    );

    const client = createClient();
    await expect(client.getCurrentUser()).rejects.toThrow();
  });

  it("calls GET /__api__/v1/user", async () => {
    mockRequest.mockResolvedValue(jsonResponse(validUserDTO()));

    const client = createClient();
    await client.getCurrentUser();

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0];
    expect(call.url).toBe("/__api__/v1/user");
    expect(call.method).toBe("GET");
  });
});

// ---------------------------------------------------------------------------
// contentDetails
// ---------------------------------------------------------------------------

describe("contentDetails", () => {
  const contentId = ContentID("content-guid-abc");
  const detailsDTO: ContentDetailsDTO = {
    guid: contentId,
    name: "my-app",
    title: "My App",
    description: "",
    access_type: "acl",
    connection_timeout: null,
    read_timeout: null,
    init_timeout: null,
    idle_timeout: null,
    max_processes: null,
    min_processes: null,
    max_conns_per_process: null,
    load_factor: null,
    created_time: "2024-01-01T00:00:00Z",
    last_deployed_time: "2024-01-01T00:00:00Z",
    bundle_id: "bundle-1",
    app_mode: "python-dash",
    content_category: "",
    parameterized: false,
    cluster_name: null,
    image_name: null,
    r_version: null,
    py_version: "3.11.0",
    quarto_version: null,
    run_as: null,
    run_as_current_user: false,
    owner_guid: "owner-guid-123",
    content_url: "https://connect.example.com/content/content-guid-abc/",
    dashboard_url:
      "https://connect.example.com/connect/#/apps/content-guid-abc",
    app_role: "owner",
    locked: false,
    id: "42",
  };

  it("returns the full content details DTO", async () => {
    mockRequest.mockResolvedValue(jsonResponse(detailsDTO));

    const client = createClient();
    const { data } = await client.contentDetails(contentId);

    expect(data).toEqual(detailsDTO);
  });

  it("uses contentId in the URL path", async () => {
    mockRequest.mockResolvedValue(jsonResponse(detailsDTO));

    const client = createClient();
    await client.contentDetails(contentId);

    const call = mockRequest.mock.calls[0][0];
    expect(call.url).toBe(`/__api__/v1/content/${contentId}`);
  });

  it("throws on non-2xx", async () => {
    mockRequest.mockResolvedValue(textResponse("not found", 404, "Not Found"));

    const client = createClient();
    await expect(client.contentDetails(contentId)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// createDeployment
// ---------------------------------------------------------------------------

describe("createDeployment", () => {
  it("POSTs the body and returns the full content details", async () => {
    const responseBody = {
      guid: "new-content-guid",
      name: "my-app",
      title: null,
    };
    mockRequest.mockResolvedValue(jsonResponse(responseBody));

    const client = createClient();
    const { data } = await client.createDeployment({ name: "my-app" });

    expect(data).toEqual(responseBody);
    const call = mockRequest.mock.calls[0][0];
    expect(call.url).toBe("/__api__/v1/content");
    expect(call.method).toBe("POST");
    expect(call.data).toEqual({ name: "my-app" });
  });

  it("throws on non-2xx", async () => {
    mockRequest.mockResolvedValue(textResponse("conflict", 409, "Conflict"));

    const client = createClient();
    await expect(client.createDeployment({ name: "dup" })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// updateDeployment
// ---------------------------------------------------------------------------

describe("updateDeployment", () => {
  const contentId = ContentID("content-123");

  it("PATCHes the content and returns void", async () => {
    mockRequest.mockResolvedValue(jsonResponse({}, 200));

    const client = createClient();
    const result = await client.updateDeployment(contentId, {
      title: "New Title",
    });

    expect(result).toBeUndefined();
    const call = mockRequest.mock.calls[0][0];
    expect(call.url).toBe(`/__api__/v1/content/${contentId}`);
    expect(call.method).toBe("PATCH");
  });

  it("throws on non-2xx", async () => {
    mockRequest.mockResolvedValue(
      textResponse("bad request", 400, "Bad Request"),
    );

    const client = createClient();
    await expect(
      client.updateDeployment(contentId, { title: "x" }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getEnvVars
// ---------------------------------------------------------------------------

describe("getEnvVars", () => {
  const contentId = ContentID("content-123");

  it("returns an array of environment variable names", async () => {
    const envNames = ["DATABASE_URL", "SECRET_KEY"];
    mockRequest.mockResolvedValue(jsonResponse(envNames));

    const client = createClient();
    const { data } = await client.getEnvVars(contentId);

    expect(data).toEqual(envNames);
  });

  it("calls the correct URL", async () => {
    mockRequest.mockResolvedValue(jsonResponse([]));

    const client = createClient();
    await client.getEnvVars(contentId);

    const call = mockRequest.mock.calls[0][0];
    expect(call.url).toBe(`/__api__/v1/content/${contentId}/environment`);
  });
});

// ---------------------------------------------------------------------------
// setEnvVars
// ---------------------------------------------------------------------------

describe("setEnvVars", () => {
  const contentId = ContentID("content-123");

  it("converts Record to [{name,value}] array in the body", async () => {
    mockRequest.mockResolvedValue({
      status: 204,
      statusText: "No Content",
      data: null,
      headers: {},
      config: {},
    });

    const client = createClient();
    await client.setEnvVars(contentId, { FOO: "bar", BAZ: "qux" });

    const call = mockRequest.mock.calls[0][0];
    expect(call.url).toBe(`/__api__/v1/content/${contentId}/environment`);
    expect(call.method).toBe("PATCH");
    expect(call.data).toEqual([
      { name: "FOO", value: "bar" },
      { name: "BAZ", value: "qux" },
    ]);
  });

  it("throws on non-2xx", async () => {
    mockRequest.mockResolvedValue(
      textResponse("error", 500, "Internal Server Error"),
    );

    const client = createClient();
    await expect(
      client.setEnvVars(contentId, { KEY: "val" }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// uploadBundle
// ---------------------------------------------------------------------------

describe("uploadBundle", () => {
  const contentId = ContentID("content-123");

  it("streams application/gzip with content-length and returns full BundleDTO", async () => {
    const bundleResponse = {
      id: "bundle-42",
      content_guid: contentId,
      active: true,
      size: 1024,
    };
    mockRequest.mockResolvedValue(jsonResponse(bundleResponse));

    const body = Readable.from(Buffer.from([0x1f, 0x8b, 0x08]));
    const client = createClient();
    const { data } = await client.uploadBundle(
      contentId,
      () => body,
      3,
      "abc123==",
    );

    expect(data).toEqual(bundleResponse);
    const call = mockRequest.mock.calls[0][0];
    expect(call.url).toBe(`/__api__/v1/content/${contentId}/bundles`);
    expect(call.method).toBe("POST");
    expect(call.data).toBe(body);
    expect(call.headers["Content-Type"]).toBe("application/gzip");
    expect(call.headers["Content-Length"]).toBe(3);
    expect(call.headers["X-Content-Checksum"]).toBe("abc123==");
  });

  it("forwards the freshly created stream body", async () => {
    mockRequest.mockResolvedValue(
      jsonResponse({ id: "b-1", content_guid: contentId, active: true }),
    );

    const body = Readable.from(Buffer.from([0x1f, 0x8b, 0x08, 0x00]));
    const client = createClient();
    await client.uploadBundle(contentId, () => body, 4, "deadbeef==");

    const call = mockRequest.mock.calls[0][0];
    expect(call.data).toBe(body);
    expect(call.headers["Content-Length"]).toBe(4);
  });

  it("keeps axios on its native transport (instance maxRedirects: 0)", () => {
    // Instance-level maxRedirects: 0 forces axios's native streaming transport
    // instead of follow-redirects, which would otherwise buffer the whole body
    // in memory. Redirects are then followed manually per hop.
    createClient();
    const call = vi.mocked(axios.create).mock.calls.at(-1)?.[0];
    expect(call?.maxRedirects).toBe(0);
  });

  it("throws on non-2xx", async () => {
    mockRequest.mockResolvedValue(
      textResponse("too large", 413, "Payload Too Large"),
    );

    const client = createClient();
    await expect(
      client.uploadBundle(
        contentId,
        () => Readable.from(Buffer.from([1])),
        1,
        "x==",
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Redirect handling (client-wide, via attachRedirectHandling)
// ---------------------------------------------------------------------------

describe("Redirect handling", () => {
  it("follows a 302 (GET) to an absolute Location and returns the final payload", async () => {
    mockRequest
      .mockResolvedValueOnce(
        redirectResponse(302, "https://new-host.example.com/__api__/v1/user"),
      )
      .mockResolvedValueOnce(jsonResponse(validUserDTO()));

    const client = createClient();
    const user = await client.getCurrentUser();

    expect(user.id).toBe("user-guid-123");
    expect(mockRequest).toHaveBeenCalledTimes(2);
    const second = mockRequest.mock.calls[1][0] as Record<string, unknown>;
    expect(second.url).toBe("https://new-host.example.com/__api__/v1/user");
  });

  it.each([301, 302, 307, 308])(
    "preserves POST method and JSON body across a %i redirect",
    async (status) => {
      mockRequest
        .mockResolvedValueOnce(
          redirectResponse(
            status,
            "https://connect.example.com/__api__/v1/content-moved",
          ),
        )
        .mockResolvedValueOnce(jsonResponse({ guid: "new-content" }, 201));

      const client = createClient();
      await client.createDeployment({ name: "my-app" });

      expect(mockRequest).toHaveBeenCalledTimes(2);
      const second = mockRequest.mock.calls[1][0] as Record<string, unknown>;
      expect(second.method).toBe("POST");
      expect(second.data).toEqual({ name: "my-app" });
      expect(second.url).toBe(
        "https://connect.example.com/__api__/v1/content-moved",
      );
    },
  );

  it.each([
    ["/after", "https://connect.example.com/after"],
    ["after", "https://connect.example.com/rsc/__api__/v1/after"],
  ])(
    "resolves a relative Location (%s) against the request's full URL",
    async (location, expected) => {
      const client = new ConnectAPI({
        url: "https://connect.example.com/rsc",
        apiKey: API_KEY,
      });
      mockRequest
        .mockResolvedValueOnce(redirectResponse(302, location))
        .mockResolvedValueOnce(jsonResponse(validUserDTO()));

      await client.getCurrentUser();

      const second = mockRequest.mock.calls[1][0] as Record<string, unknown>;
      expect(second.url).toBe(expected);
    },
  );

  it("forwards credentials across a cross-origin (http→https) redirect", async () => {
    const client = new ConnectAPI({
      url: "http://old-host.example.com",
      apiKey: API_KEY,
    });
    mockRequest
      .mockResolvedValueOnce(
        redirectResponse(301, "https://new-host.example.com/__api__/v1/user"),
      )
      .mockResolvedValueOnce(jsonResponse(validUserDTO()));

    await client.getCurrentUser();

    const second = mockRequest.mock.calls[1][0] as Record<string, unknown>;
    expect(second.url).toBe("https://new-host.example.com/__api__/v1/user");
    const headers = second.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Key ${API_KEY}`);
  });

  it("re-signs token auth against the redirect target's pathname", async () => {
    const { privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const privateKeyBase64 = Buffer.from(
      privateKey.export({ format: "der", type: "pkcs1" }),
    ).toString("base64");
    const TOKEN = "Tredirect-signing";

    const client = new ConnectAPI({
      url: BASE_URL,
      token: TOKEN,
      privateKey: privateKeyBase64,
    });
    mockRequest
      .mockResolvedValueOnce(
        redirectResponse(
          307,
          "https://other.example.com/__api__/v1/user-moved",
        ),
      )
      .mockResolvedValueOnce(jsonResponse(validUserDTO()));

    await client.getCurrentUser();

    const first = (mockRequest.mock.calls[0][0] as Record<string, unknown>)
      ._signedHeaders as Record<string, string>;
    const second = (mockRequest.mock.calls[1][0] as Record<string, unknown>)
      ._signedHeaders as Record<string, string>;

    // The second hop signs the redirect target's PATHNAME (not the absolute
    // URL, and not the original path). Re-sign the canonical string ourselves
    // and compare (RSA-SHA1 PKCS#1 v1.5 is deterministic).
    const expectedSig = rsaSha1Sign(
      buildCanonicalRequest(
        "GET",
        "/__api__/v1/user-moved",
        second["Date"],
        second["X-Content-Checksum"],
      ),
      privateKeyBase64,
    );
    expect(second["X-Auth-Signature"]).toBe(expectedSig);

    // It must not be signing the whole absolute URL.
    const absoluteSig = rsaSha1Sign(
      buildCanonicalRequest(
        "GET",
        "https://other.example.com/__api__/v1/user-moved",
        second["Date"],
        second["X-Content-Checksum"],
      ),
      privateKeyBase64,
    );
    expect(second["X-Auth-Signature"]).not.toBe(absoluteSig);
    // Different path than hop 1, so the signature changes.
    expect(second["X-Auth-Signature"]).not.toBe(first["X-Auth-Signature"]);
    expect(second["X-Auth-Token"]).toBe(TOKEN);
  });

  it("re-signs a streamed upload redirect with the same precomputed checksum", async () => {
    const { privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const privateKeyBase64 = Buffer.from(
      privateKey.export({ format: "der", type: "pkcs1" }),
    ).toString("base64");

    const client = new ConnectAPI({
      url: BASE_URL,
      token: "Tupload",
      privateKey: privateKeyBase64,
    });
    mockRequest
      .mockResolvedValueOnce(
        redirectResponse(308, "https://cdn.example.com/upload"),
      )
      .mockResolvedValueOnce(
        jsonResponse({ id: "b-1", content_guid: "c-1", active: true }),
      );

    await client.uploadBundle(
      ContentID("c-1"),
      () => Readable.from(Buffer.from([1, 2, 3])),
      3,
      "CHK==",
    );

    const first = (mockRequest.mock.calls[0][0] as Record<string, unknown>)
      ._signedHeaders as Record<string, string>;
    const second = (mockRequest.mock.calls[1][0] as Record<string, unknown>)
      ._signedHeaders as Record<string, string>;
    expect(first["X-Content-Checksum"]).toBe("CHK==");
    expect(second["X-Content-Checksum"]).toBe("CHK==");
  });

  it("opens a fresh stream from the factory on each redirect hop", async () => {
    // Capture the body/headers each hop actually sends. We snapshot at call
    // time because the redirect handler mutates the config in place to re-issue
    // (real axios clones per request; our mock records the live object).
    const responses = [
      redirectResponse(307, "https://a.example.com/1"),
      redirectResponse(307, "https://b.example.com/2"),
      jsonResponse({ id: "b-1", content_guid: "c-1", active: true }),
    ];
    const sentData: unknown[] = [];
    const sentHeaders: Array<Record<string, unknown>> = [];
    let hop = 0;
    mockRequest.mockImplementation((cfg: Record<string, unknown>) => {
      sentData.push(cfg.data);
      sentHeaders.push(cfg.headers as Record<string, unknown>);
      return Promise.resolve(responses[hop++]);
    });

    const streams: Readable[] = [];
    const makeBody = (): Readable => {
      const s = Readable.from(Buffer.from([0x1f, 0x8b]));
      streams.push(s);
      return s;
    };

    const client = createClient();
    await client.uploadBundle(ContentID("c-1"), makeBody, 2, "abc==");

    // Initial request + 2 redirects = 3 factory calls, each a distinct stream.
    expect(streams).toHaveLength(3);
    expect(new Set(streams).size).toBe(3);

    // Each hop sent the stream created for it; the final hop sent the last one.
    expect(sentData).toEqual([streams[0], streams[1], streams[2]]);

    // Content-Length and checksum are identical on every hop.
    for (const headers of sentHeaders) {
      expect(headers["Content-Length"]).toBe(2);
      expect(headers["X-Content-Checksum"]).toBe("abc==");
    }

    // Each consumed stream is destroyed before the next hop opens a new one;
    // the final one is destroyed by uploadBundle's finally.
    expect(streams[0].destroyed).toBe(true);
    expect(streams[1].destroyed).toBe(true);
    expect(streams[2].destroyed).toBe(true);
  });

  it("gives up after MAX_REDIRECTS hops with a descriptive error", async () => {
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      mockRequest.mockResolvedValueOnce(
        redirectResponse(302, `https://h${i}.example.com/x`),
      );
    }

    const client = createClient();
    await expect(client.getCurrentUser()).rejects.toThrow(/Too many redirects/);
    expect(mockRequest).toHaveBeenCalledTimes(MAX_REDIRECTS + 1);
  });

  it("does not follow a 303 and rejects with the original error", async () => {
    mockRequest.mockResolvedValueOnce(
      redirectResponse(303, "https://x.example.com/y"),
    );

    const client = createClient();
    await expect(client.getCurrentUser()).rejects.toMatchObject({
      response: { status: 303 },
    });
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it("does not follow a 302 without a Location header", async () => {
    mockRequest.mockResolvedValueOnce(redirectResponse(302));

    const client = createClient();
    await expect(client.getCurrentUser()).rejects.toMatchObject({
      response: { status: 302 },
    });
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it("propagates an abort mid-redirect and destroys the live upload stream", async () => {
    const cancelErr = Object.assign(new Error("canceled"), {
      __CANCEL__: true,
    });
    mockRequest
      .mockResolvedValueOnce(
        redirectResponse(307, "https://cdn.example.com/upload"),
      )
      .mockRejectedValueOnce(cancelErr);

    const streams: Readable[] = [];
    const makeBody = (): Readable => {
      const s = Readable.from(Buffer.from([1, 2, 3]));
      streams.push(s);
      return s;
    };

    const client = createClient();
    await expect(
      client.uploadBundle(
        ContentID("c-1"),
        makeBody,
        3,
        "abc==",
        AbortSignal.abort(),
      ),
    ).rejects.toBe(cancelErr);

    // Initial stream + one redirect hop = 2 streams, both destroyed: the first
    // by the redirect factory, the second by uploadBundle's finally.
    expect(streams).toHaveLength(2);
    expect(streams[0].destroyed).toBe(true);
    expect(streams[1].destroyed).toBe(true);
  });

  it.each([404, 500])("does not re-issue on a %i error", async (status) => {
    mockRequest.mockResolvedValueOnce(textResponse("err", status));

    const client = createClient();
    await expect(client.getCurrentUser()).rejects.toThrow(/status code/);
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// downloadBundle
// ---------------------------------------------------------------------------

describe("downloadBundle", () => {
  const contentId = ContentID("content-123");
  const bundleId = BundleID("bundle-42");

  it("returns a Uint8Array of the bundle data", async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    mockRequest.mockResolvedValue(binaryResponse(data));

    const client = createClient();
    const result = await client.downloadBundle(contentId, bundleId);

    expect(result).toEqual(data);
  });

  it("calls the correct download URL", async () => {
    mockRequest.mockResolvedValue(binaryResponse(new Uint8Array()));

    const client = createClient();
    await client.downloadBundle(contentId, bundleId);

    const call = mockRequest.mock.calls[0][0];
    expect(call.url).toBe(
      `/__api__/v1/content/${contentId}/bundles/${bundleId}/download`,
    );
  });

  it("throws on non-2xx", async () => {
    mockRequest.mockResolvedValue(textResponse("not found", 404, "Not Found"));

    const client = createClient();
    await expect(client.downloadBundle(contentId, bundleId)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// deployBundle
// ---------------------------------------------------------------------------

describe("deployBundle", () => {
  const contentId = ContentID("content-123");
  const bundleId = BundleID("bundle-42");

  it("POSTs {bundle_id} and returns the full deploy output", async () => {
    const deployResponse = { task_id: "task-99" };
    mockRequest.mockResolvedValue(jsonResponse(deployResponse));

    const client = createClient();
    const { data } = await client.deployBundle(contentId, bundleId);

    expect(data).toEqual(deployResponse);
    const call = mockRequest.mock.calls[0][0];
    expect(call.url).toBe(`/__api__/v1/content/${contentId}/deploy`);
    expect(call.method).toBe("POST");
    expect(call.data).toEqual({ bundle_id: bundleId });
  });

  it("throws on non-2xx", async () => {
    mockRequest.mockResolvedValue(
      textResponse("err", 500, "Internal Server Error"),
    );

    const client = createClient();
    await expect(client.deployBundle(contentId, bundleId)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// waitForTask
// ---------------------------------------------------------------------------

describe("waitForTask", () => {
  const taskId = TaskID("task-99");

  it("returns the full TaskDTO when task completes without error", async () => {
    const taskResponse = {
      id: taskId,
      output: ["line 1"],
      result: null,
      finished: true,
      code: 0,
      error: "",
      last: 1,
    };
    mockRequest.mockResolvedValue(jsonResponse(taskResponse));

    const client = createClient();
    const result = await client.waitForTask(taskId, 0);

    expect(result).toEqual(taskResponse);
  });

  it("throws when task finishes with an error", async () => {
    mockRequest.mockResolvedValue(
      jsonResponse({
        id: taskId,
        output: [],
        result: null,
        finished: true,
        code: 1,
        error: "deployment failed",
        last: 0,
      }),
    );

    const client = createClient();
    await expect(client.waitForTask(taskId, 0)).rejects.toThrow(
      "deployment failed",
    );
  });

  it("polls with first= query parameter and follows last cursor", async () => {
    mockRequest
      .mockResolvedValueOnce(
        jsonResponse({
          id: taskId,
          output: ["line 1"],
          result: null,
          finished: false,
          code: 0,
          error: "",
          last: 3,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: taskId,
          output: ["line 2"],
          result: null,
          finished: true,
          code: 0,
          error: "",
          last: 5,
        }),
      );

    const client = createClient();
    await client.waitForTask(taskId, 0);

    expect(mockRequest).toHaveBeenCalledTimes(2);
    const call1 = mockRequest.mock.calls[0][0];
    const call2 = mockRequest.mock.calls[1][0];
    expect(call1.url).toBe(`/__api__/v1/tasks/${taskId}`);
    expect(call1.params).toEqual({ first: 0 });
    expect(call2.url).toBe(`/__api__/v1/tasks/${taskId}`);
    expect(call2.params).toEqual({ first: 3 });
  });

  it("calls onOutput with each batch of log lines", async () => {
    mockRequest
      .mockResolvedValueOnce(
        jsonResponse({
          id: taskId,
          output: ["Building..."],
          result: null,
          finished: false,
          code: 0,
          error: "",
          last: 1,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: taskId,
          output: ["Installing packages...", "Launching content..."],
          result: null,
          finished: true,
          code: 0,
          error: "",
          last: 3,
        }),
      );

    const batches: string[][] = [];
    const onOutput = (lines: string[]) => batches.push(lines);

    const client = createClient();
    await client.waitForTask(taskId, 0, onOutput);

    expect(batches).toEqual([
      ["Building..."],
      ["Installing packages...", "Launching content..."],
    ]);
  });

  it("does not call onOutput when output is empty", async () => {
    mockRequest
      .mockResolvedValueOnce(
        jsonResponse({
          id: taskId,
          output: [],
          result: null,
          finished: false,
          code: 0,
          error: "",
          last: 0,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: taskId,
          output: ["done"],
          result: null,
          finished: true,
          code: 0,
          error: "",
          last: 1,
        }),
      );

    const batches: string[][] = [];
    const onOutput = (lines: string[]) => batches.push(lines);

    const client = createClient();
    await client.waitForTask(taskId, 0, onOutput);

    expect(batches).toEqual([["done"]]);
  });

  it("calls onOutput before throwing on task error", async () => {
    mockRequest.mockResolvedValueOnce(
      jsonResponse({
        id: taskId,
        output: ["error output"],
        result: null,
        finished: true,
        code: 1,
        error: "deployment failed",
        last: 1,
      }),
    );

    const batches: string[][] = [];
    const onOutput = (lines: string[]) => batches.push(lines);

    const client = createClient();
    await expect(client.waitForTask(taskId, 0, onOutput)).rejects.toThrow(
      "deployment failed",
    );

    expect(batches).toEqual([["error output"]]);
  });

  it("works without onOutput (backward compatible)", async () => {
    mockRequest.mockResolvedValue(
      jsonResponse({
        id: taskId,
        output: ["line 1"],
        result: null,
        finished: true,
        code: 0,
        error: "",
        last: 1,
      }),
    );

    const client = createClient();
    const result = await client.waitForTask(taskId, 0);

    expect(result.output).toEqual(["line 1"]);
  });
});

// ---------------------------------------------------------------------------
// validateDeployment
// ---------------------------------------------------------------------------

describe("validateDeployment", () => {
  const contentId = ContentID("content-123");

  it("returns void on 200", async () => {
    mockRequest.mockResolvedValue(textResponse("OK", 200));

    const client = createClient();
    const result = await client.validateDeployment(contentId);

    expect(result).toBeUndefined();
  });

  it("returns void on 404 (acceptable)", async () => {
    mockRequest.mockResolvedValue(textResponse("not found", 404, "Not Found"));

    const client = createClient();
    const result = await client.validateDeployment(contentId);

    expect(result).toBeUndefined();
  });

  it("throws on 500", async () => {
    mockRequest.mockResolvedValue(
      textResponse("server error", 500, "Internal Server Error"),
    );

    const client = createClient();
    await expect(client.validateDeployment(contentId)).rejects.toThrow();
  });

  it("throws on 502", async () => {
    mockRequest.mockResolvedValue(
      textResponse("bad gateway", 502, "Bad Gateway"),
    );

    const client = createClient();
    await expect(client.validateDeployment(contentId)).rejects.toThrow();
  });

  it("calls GET /content/:id/", async () => {
    mockRequest.mockResolvedValue(textResponse("OK", 200));

    const client = createClient();
    await client.validateDeployment(contentId);

    const call = mockRequest.mock.calls[0][0];
    expect(call.url).toBe(`/content/${contentId}/`);
  });
});

// ---------------------------------------------------------------------------
// getIntegrations
// ---------------------------------------------------------------------------

describe("getIntegrations", () => {
  it("returns parsed integration array", async () => {
    const integrations = [
      {
        guid: "int-1",
        name: "GitHub",
        description: "GitHub integration",
        auth_type: "oauth2",
        template: "github",
        config: {},
        created_time: "2024-01-01T00:00:00Z",
      },
    ];
    mockRequest.mockResolvedValue(jsonResponse(integrations));

    const client = createClient();
    const { data } = await client.getIntegrations();

    expect(data).toEqual(integrations);
  });

  it("calls GET /__api__/v1/oauth/integrations", async () => {
    mockRequest.mockResolvedValue(jsonResponse([]));

    const client = createClient();
    await client.getIntegrations();

    const call = mockRequest.mock.calls[0][0];
    expect(call.url).toBe("/__api__/v1/oauth/integrations");
  });
});

// ---------------------------------------------------------------------------
// getSettings
// ---------------------------------------------------------------------------

describe("getSettings", () => {
  const userDTO = validUserDTO();
  const general = {
    license: {
      "allow-apis": true,
      "current-user-execution": false,
      "enable-launcher": false,
      "oauth-integrations": false,
    },
    runtimes: ["python"],
    git_enabled: false,
    git_available: false,
    execution_type: "native",
    enable_runtime_constraints: false,
    enable_image_management: false,
    default_image_selection_enabled: false,
    default_environment_management_selection: true,
    default_r_environment_management: true,
    default_py_environment_management: true,
    oauth_integrations_enabled: false,
  };
  const application = {
    access_types: ["acl", "logged_in", "all"],
    run_as: "",
    run_as_group: "",
    run_as_current_user: false,
  };
  const scheduler = {
    min_processes: 0,
    max_processes: 3,
    max_conns_per_process: 20,
    load_factor: 0.5,
    init_timeout: 60,
    idle_timeout: 120,
    min_processes_limit: 0,
    max_processes_limit: 10,
    connection_timeout: 5,
    read_timeout: 30,
    cpu_request: 0,
    max_cpu_request: 0,
    cpu_limit: 0,
    max_cpu_limit: 0,
    memory_request: 0,
    max_memory_request: 0,
    memory_limit: 0,
    max_memory_limit: 0,
    amd_gpu_limit: 0,
    max_amd_gpu_limit: 0,
    nvidia_gpu_limit: 0,
    max_nvidia_gpu_limit: 0,
  };
  const python = {
    installations: [{ version: "3.11.0", cluster_name: "", image_name: "" }],
    api_enabled: true,
  };
  const r = {
    installations: [{ version: "4.3.0", cluster_name: "", image_name: "" }],
  };
  const quarto = {
    installations: [{ version: "1.4.0", cluster_name: "", image_name: "" }],
  };
  const nodejs = {
    installations: [{ version: "22.11.0", cluster_name: "", image_name: "" }],
    enabled: true,
  };

  const urlResponseMap: Record<string, unknown> = {
    "/__api__/v1/user": userDTO,
    "/__api__/server_settings": general,
    "/__api__/server_settings/applications": application,
    "/__api__/server_settings/scheduler": scheduler,
    "/__api__/v1/server_settings/python": python,
    "/__api__/v1/server_settings/r": r,
    "/__api__/v1/server_settings/quarto": quarto,
    "/__api__/v1/server_settings/nodejs": nodejs,
  };

  function mockSettingsRoutes() {
    mockRequest.mockImplementation((config: { url: string }) =>
      Promise.resolve(jsonResponse(urlResponseMap[config.url])),
    );
  }

  it("makes 8 request calls to the correct URLs", async () => {
    mockSettingsRoutes();

    const client = createClient();
    await client.getSettings();

    expect(mockRequest).toHaveBeenCalledTimes(8);

    const urls = mockRequest.mock.calls
      .map((call: unknown[]) => (call[0] as { url: string }).url)
      .sort();
    expect(urls).toEqual(Object.keys(urlResponseMap).sort());
  });

  it("returns an AllSettings composite object", async () => {
    mockSettingsRoutes();

    const client = createClient();
    const settings = await client.getSettings();

    expect(settings.general).toEqual(general);
    expect(settings.user).toEqual(userDTO);
    expect(settings.application).toEqual(application);
    expect(settings.scheduler).toEqual(scheduler);
    expect(settings.python).toEqual(python);
    expect(settings.r).toEqual(r);
    expect(settings.quarto).toEqual(quarto);
    expect(settings.nodejs).toEqual(nodejs);
  });

  it("uses app-mode-specific scheduler path when appMode is provided", async () => {
    const appModeMap: Record<string, unknown> = {
      ...urlResponseMap,
      "/__api__/server_settings/scheduler/python-shiny": scheduler,
    };
    mockRequest.mockImplementation((config: { url: string }) =>
      Promise.resolve(jsonResponse(appModeMap[config.url])),
    );

    const client = createClient();
    await client.getSettings("python-shiny");

    const urls = mockRequest.mock.calls.map(
      (call: unknown[]) => (call[0] as { url: string }).url,
    );
    expect(urls).toContain("/__api__/server_settings/scheduler/python-shiny");
    expect(urls).not.toContain("/__api__/server_settings/scheduler");
  });

  it("uses base scheduler path for static content", async () => {
    mockSettingsRoutes();

    const client = createClient();
    await client.getSettings("static");

    const urls = mockRequest.mock.calls.map(
      (call: unknown[]) => (call[0] as { url: string }).url,
    );
    expect(urls).toContain("/__api__/server_settings/scheduler");
  });

  it("uses base scheduler path for unknown app mode", async () => {
    mockSettingsRoutes();

    const client = createClient();
    await client.getSettings("unknown-mode");

    const urls = mockRequest.mock.calls.map(
      (call: unknown[]) => (call[0] as { url: string }).url,
    );
    expect(urls).toContain("/__api__/server_settings/scheduler");
    expect(urls).not.toContain(
      "/__api__/server_settings/scheduler/unknown-mode",
    );
  });

  it('uses scheduler/nodejs path when appMode is "nodejs"', async () => {
    const appModeMap: Record<string, unknown> = {
      ...urlResponseMap,
      "/__api__/server_settings/scheduler/nodejs": scheduler,
    };
    mockRequest.mockImplementation((config: { url: string }) =>
      Promise.resolve(jsonResponse(appModeMap[config.url])),
    );

    const client = createClient();
    await client.getSettings("nodejs");

    const urls = mockRequest.mock.calls.map(
      (call: unknown[]) => (call[0] as { url: string }).url,
    );
    expect(urls).toContain("/__api__/server_settings/scheduler/nodejs");
    expect(urls).not.toContain("/__api__/server_settings/scheduler");
  });

  it("uses base scheduler path when no appMode is provided", async () => {
    mockSettingsRoutes();

    const client = createClient();
    await client.getSettings();

    const urls = mockRequest.mock.calls.map(
      (call: unknown[]) => (call[0] as { url: string }).url,
    );
    expect(urls).toContain("/__api__/server_settings/scheduler");
  });

  it("falls back to empty NodejsInfo when /server_settings/nodejs 404s", async () => {
    mockRequest.mockImplementation((config: { url: string }) => {
      if (config.url === "/__api__/v1/server_settings/nodejs") {
        return Promise.resolve(
          jsonResponse({ error: "Not found" }, 404, "Not Found"),
        );
      }
      return Promise.resolve(jsonResponse(urlResponseMap[config.url]));
    });

    const client = createClient();
    const settings = await client.getSettings();

    expect(settings.nodejs).toEqual({ installations: [], enabled: false });
    // The other 7 settings must still come through correctly.
    expect(settings.general).toEqual(general);
    expect(settings.python).toEqual(python);
    expect(settings.r).toEqual(r);
    expect(settings.quarto).toEqual(quarto);
  });

  it("propagates non-404 errors from /server_settings/nodejs", async () => {
    mockRequest.mockImplementation((config: { url: string }) => {
      if (config.url === "/__api__/v1/server_settings/nodejs") {
        return Promise.resolve(
          jsonResponse({ error: "Boom" }, 500, "Internal Server Error"),
        );
      }
      return Promise.resolve(jsonResponse(urlResponseMap[config.url]));
    });

    const client = createClient();
    await expect(client.getSettings()).rejects.toThrow(
      /Request failed with status code 500/,
    );
  });
});

// ---------------------------------------------------------------------------
// registerToken
// ---------------------------------------------------------------------------

describe("registerToken", () => {
  it("POSTs token and public key to /__api__/tokens and returns claim URL", async () => {
    const client = new ConnectAPI({ url: BASE_URL });
    mockRequest.mockResolvedValueOnce(
      jsonResponse(
        {
          token_claim_url: "https://connect.example.com/connect/#/claim/abc123",
        },
        201,
      ),
    );

    const result = await client.registerToken(
      "Tabcdef1234567890",
      "base64PublicKey==",
    );

    expect(result).toEqual({
      token_claim_url: "https://connect.example.com/connect/#/claim/abc123",
    });
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "/__api__/tokens",
        data: {
          token: "Tabcdef1234567890",
          public_key: "base64PublicKey==",
          user_id: 0,
        },
      }),
    );
  });

  it("throws on non-2xx response", async () => {
    const client = new ConnectAPI({ url: BASE_URL });
    mockRequest.mockResolvedValueOnce(
      jsonResponse({ error: "forbidden" }, 403, "Forbidden"),
    );

    await expect(
      client.registerToken("Tabcdef1234567890", "base64PublicKey=="),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Token authentication
// ---------------------------------------------------------------------------

function generateTestKeyPair(): {
  privateKeyBase64: string;
} {
  const { privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const privateKeyDer = privateKey.export({ format: "der", type: "pkcs1" });
  return {
    privateKeyBase64: Buffer.from(privateKeyDer).toString("base64"),
  };
}

describe("Token authentication", () => {
  const TOKEN = "Tabc123def456";
  const { privateKeyBase64: PRIVATE_KEY } = generateTestKeyPair();

  function createTokenClient(): ConnectAPI {
    return new ConnectAPI({
      url: BASE_URL,
      token: TOKEN,
      privateKey: PRIVATE_KEY,
    });
  }

  it("does not set static Authorization header when using token auth", () => {
    createTokenClient();

    const call = vi.mocked(axios.create).mock.calls.at(-1)?.[0];
    expect(call?.headers).toBeUndefined();
  });

  it("adds signing headers to requests via interceptor", async () => {
    mockRequest.mockResolvedValue(jsonResponse(validUserDTO()));

    const client = createTokenClient();
    await client.getCurrentUser();

    expect(mockRequest).toHaveBeenCalledOnce();
    const config = mockRequest.mock.calls[0][0] as Record<string, unknown>;
    const signedHeaders = config._signedHeaders as Record<string, string>;

    expect(signedHeaders).toBeDefined();
    expect(signedHeaders["X-Auth-Token"]).toBe(TOKEN);
    expect(signedHeaders["X-Auth-Signature"]).toBeDefined();
    expect(signedHeaders["X-Content-Checksum"]).toBeDefined();
    expect(signedHeaders["Date"]).toBeDefined();
  });

  it("computes checksum from request body for POST requests", async () => {
    const responseBody = { guid: "new-content-guid", name: "my-app" };
    mockRequest.mockResolvedValue(jsonResponse(responseBody));

    const client = createTokenClient();
    await client.createDeployment({ name: "my-app" });

    const config = mockRequest.mock.calls[0][0] as Record<string, unknown>;
    const signedHeaders = config._signedHeaders as Record<string, string>;

    // Checksum should be MD5 of the JSON body
    const expectedBody = JSON.stringify({ name: "my-app" });
    const expectedChecksum = crypto
      .createHash("md5")
      .update(expectedBody)
      .digest("base64");
    expect(signedHeaders["X-Content-Checksum"]).toBe(expectedChecksum);
  });

  it("signs the precomputed checksum for streamed bundle uploads", async () => {
    const bundleResponse = { id: "b-1", content_guid: "c-1", active: true };
    mockRequest.mockResolvedValue(jsonResponse(bundleResponse));

    const gzipBytes = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0xff, 0xfe]);
    // The caller precomputes the bundle checksum (the stream can't be hashed
    // in the interceptor) and passes it; signing must use that exact value.
    const checksum = crypto
      .createHash("md5")
      .update(gzipBytes)
      .digest("base64");

    const client = createTokenClient();
    await client.uploadBundle(
      ContentID("c-1"),
      () => Readable.from(gzipBytes),
      gzipBytes.length,
      checksum,
    );

    const config = mockRequest.mock.calls[0][0] as Record<string, unknown>;
    const signedHeaders = config._signedHeaders as Record<string, string>;

    expect(signedHeaders["X-Content-Checksum"]).toBe(checksum);
  });

  it("throws when a streamed body has no precomputed checksum", async () => {
    const client = createTokenClient();

    // The signing interceptor cannot hash a stream, so a streamed body must
    // carry a precomputed X-Content-Checksum header. No public method streams a
    // body without also supplying that header, so reach the underlying axios
    // instance to exercise the interceptor directly.
    const inner: {
      post: (
        url: string,
        data: unknown,
        config?: Record<string, unknown>,
      ) => Promise<unknown>;
    } = (client as unknown as { client: typeof inner }).client;

    await expect(
      inner.post(
        "/__api__/v1/content/c-1/bundles",
        Readable.from(Buffer.from([0x1f, 0x8b, 0x08])),
        { headers: { "Content-Type": "application/gzip" } },
      ),
    ).rejects.toThrow(
      "Streamed request body requires a precomputed X-Content-Checksum header",
    );
  });

  it("Date header ends with GMT", async () => {
    mockRequest.mockResolvedValue(jsonResponse(validUserDTO()));

    const client = createTokenClient();
    await client.getCurrentUser();

    const config = mockRequest.mock.calls[0][0] as Record<string, unknown>;
    const signedHeaders = config._signedHeaders as Record<string, string>;
    expect(signedHeaders["Date"]).toMatch(/GMT$/);
  });
});

// ---------------------------------------------------------------------------
// Snowflake authentication
// ---------------------------------------------------------------------------

describe("Snowflake + API key authentication", () => {
  it("sets both Snowflake Authorization and X-RSC-Authorization headers", () => {
    new ConnectAPI({
      url: BASE_URL,
      snowflakeToken: "sf-session-token-abc",
      apiKey: "connect-api-key-123",
    });

    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: BASE_URL,
        headers: expect.objectContaining({
          Authorization: 'Snowflake Token="sf-session-token-abc"',
          "X-RSC-Authorization": "Key connect-api-key-123",
        }),
      }),
    );
  });

  it("does not add signing interceptor", async () => {
    mockRequest.mockResolvedValue(jsonResponse(validUserDTO()));

    const client = new ConnectAPI({
      url: BASE_URL,
      snowflakeToken: "sf-session-token-abc",
      apiKey: "connect-api-key-123",
    });
    await client.getCurrentUser();

    const config = mockRequest.mock.calls[0][0] as Record<string, unknown>;
    expect(config._signedHeaders).toBeUndefined();
  });
});

describe("Snowflake + token authentication", () => {
  const SF_TOKEN = "sf-session-token-abc";
  const { privateKeyBase64: SF_PRIVATE_KEY } = generateTestKeyPair();
  const SF_CONNECT_TOKEN = "Tconnect-token-456";

  it("sets Snowflake Authorization as static header", () => {
    new ConnectAPI({
      url: BASE_URL,
      snowflakeToken: SF_TOKEN,
      token: SF_CONNECT_TOKEN,
      privateKey: SF_PRIVATE_KEY,
    });

    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: BASE_URL,
        headers: expect.objectContaining({
          Authorization: `Snowflake Token="${SF_TOKEN}"`,
        }),
      }),
    );
  });

  it("adds signing interceptor for Connect token auth", async () => {
    mockRequest.mockResolvedValue(jsonResponse(validUserDTO()));

    const client = new ConnectAPI({
      url: BASE_URL,
      snowflakeToken: SF_TOKEN,
      token: SF_CONNECT_TOKEN,
      privateKey: SF_PRIVATE_KEY,
    });
    await client.getCurrentUser();

    const config = mockRequest.mock.calls[0][0] as Record<string, unknown>;
    const signedHeaders = config._signedHeaders as Record<string, string>;

    expect(signedHeaders).toBeDefined();
    expect(signedHeaders["X-Auth-Token"]).toBe(SF_CONNECT_TOKEN);
    expect(signedHeaders["X-Auth-Signature"]).toBeDefined();
    expect(signedHeaders["X-Content-Checksum"]).toBeDefined();
    expect(signedHeaders["Date"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Constructor validation
// ---------------------------------------------------------------------------

describe("Constructor validation", () => {
  it("allows no credentials (for URL reachability checks)", () => {
    expect(() => new ConnectAPI({ url: BASE_URL })).not.toThrow();
  });

  it("throws if only token is provided without privateKey", () => {
    expect(
      // @ts-expect-error - union type rejects partial token auth at compile time; testing runtime safety net
      () => new ConnectAPI({ url: BASE_URL, token: "Ttoken123" }),
    ).toThrow(
      "ConnectAPI requires both token and privateKey for token authentication",
    );
  });

  it("throws if only privateKey is provided without token", () => {
    expect(
      // @ts-expect-error - union type rejects partial token auth at compile time; testing runtime safety net
      () => new ConnectAPI({ url: BASE_URL, privateKey: "somekey" }),
    ).toThrow(
      "ConnectAPI requires both token and privateKey for token authentication",
    );
  });

  it("accepts apiKey auth", () => {
    expect(
      () => new ConnectAPI({ url: BASE_URL, apiKey: API_KEY }),
    ).not.toThrow();
  });

  it("accepts token+privateKey auth", () => {
    const { privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const privateKeyBase64 = Buffer.from(
      privateKey.export({ format: "der", type: "pkcs1" }),
    ).toString("base64");

    expect(
      () =>
        new ConnectAPI({
          url: BASE_URL,
          token: "Ttoken123",
          privateKey: privateKeyBase64,
        }),
    ).not.toThrow();
  });

  it("accepts snowflakeToken + apiKey auth", () => {
    expect(
      () =>
        new ConnectAPI({
          url: BASE_URL,
          snowflakeToken: "sf-token",
          apiKey: "connect-key",
        }),
    ).not.toThrow();
  });

  it("accepts snowflakeToken + token+privateKey auth", () => {
    const { privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const privateKeyBase64 = Buffer.from(
      privateKey.export({ format: "der", type: "pkcs1" }),
    ).toString("base64");

    expect(
      () =>
        new ConnectAPI({
          url: BASE_URL,
          snowflakeToken: "sf-token",
          token: "Ttoken123",
          privateKey: privateKeyBase64,
        }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Cookie jar (session affinity for HA environments)
// ---------------------------------------------------------------------------

describe("Cookie jar (session affinity)", () => {
  it("forwards set-cookie from responses to subsequent requests", async () => {
    mockRequest
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        data: validUserDTO(),
        headers: { "set-cookie": ["AWSALB=abc123"] },
        config: {},
      })
      .mockResolvedValueOnce(jsonResponse(validUserDTO()));

    const client = createClient();
    await client.getCurrentUser(); // response sets the cookie
    await client.getCurrentUser(); // should forward the cookie

    const secondCall = mockRequest.mock.calls[1][0] as Record<string, unknown>;
    expect((secondCall.headers as Record<string, string>).Cookie).toBe(
      "AWSALB=abc123",
    );
  });

  it("does not send Cookie header when no set-cookie was received", async () => {
    mockRequest.mockResolvedValue(jsonResponse(validUserDTO()));

    const client = createClient();
    await client.getCurrentUser();

    const call = mockRequest.mock.calls[0][0] as Record<string, unknown>;
    expect((call.headers as Record<string, string>).Cookie).toBeUndefined();
  });

  it("updates cookies when a new set-cookie is received", async () => {
    mockRequest
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        data: validUserDTO(),
        headers: { "set-cookie": ["AWSALB=first"] },
        config: {},
      })
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        data: validUserDTO(),
        headers: { "set-cookie": ["AWSALB=second"] },
        config: {},
      })
      .mockResolvedValueOnce(jsonResponse(validUserDTO()));

    const client = createClient();
    await client.getCurrentUser();
    await client.getCurrentUser();
    await client.getCurrentUser();

    const thirdCall = mockRequest.mock.calls[2][0] as Record<string, unknown>;
    expect((thirdCall.headers as Record<string, string>).Cookie).toBe(
      "AWSALB=second",
    );
  });

  it("joins multiple cookies with semicolons", async () => {
    mockRequest
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        data: validUserDTO(),
        headers: { "set-cookie": ["AWSALB=abc", "session=xyz"] },
        config: {},
      })
      .mockResolvedValueOnce(jsonResponse(validUserDTO()));

    const client = createClient();
    await client.getCurrentUser();
    await client.getCurrentUser();

    const secondCall = mockRequest.mock.calls[1][0] as Record<string, unknown>;
    expect((secondCall.headers as Record<string, string>).Cookie).toBe(
      "AWSALB=abc; session=xyz",
    );
  });
});

// ---------------------------------------------------------------------------
// AbortSignal support
// ---------------------------------------------------------------------------

describe("AbortSignal support", () => {
  function abortedSignal(): AbortSignal {
    return AbortSignal.abort();
  }

  it("testAuthentication forwards signal to axios", async () => {
    mockRequest.mockRejectedValue(
      Object.assign(new Error("canceled"), { code: "ERR_CANCELED" }),
    );

    const client = createClient();
    await expect(client.testAuthentication(abortedSignal())).rejects.toThrow();

    const call = mockRequest.mock.calls[0][0] as Record<string, unknown>;
    expect(call.signal).toBeDefined();
  });

  it("testAuthentication rethrows cancel errors without wrapping", async () => {
    // Cancel errors should not be wrapped in ConnectAPIError so callers
    // can distinguish abort from real API failures.
    const cancelErr = Object.assign(new Error("canceled"), {
      isAxiosError: true,
      __CANCEL__: true,
      response: { status: 0, data: {} },
    });
    mockRequest.mockRejectedValue(cancelErr);

    const client = createClient();
    await expect(client.testAuthentication()).rejects.toBe(cancelErr);
  });

  it("testAuthentication still wraps non-cancel axios errors", async () => {
    mockRequest.mockRejectedValue(
      Object.assign(new Error("Request failed"), {
        isAxiosError: true,
        response: { status: 401, data: { error: "Unauthorized" } },
      }),
    );

    const client = createClient();
    await expect(client.testAuthentication()).rejects.toThrow("Unauthorized");
  });

  it("contentDetails forwards signal to axios", async () => {
    mockRequest.mockRejectedValue(
      Object.assign(new Error("canceled"), { code: "ERR_CANCELED" }),
    );

    const client = createClient();
    await expect(
      client.contentDetails(ContentID("c-1"), abortedSignal()),
    ).rejects.toThrow();

    const call = mockRequest.mock.calls[0][0] as Record<string, unknown>;
    expect(call.signal).toBeDefined();
  });

  it("createDeployment forwards signal to axios", async () => {
    mockRequest.mockRejectedValue(
      Object.assign(new Error("canceled"), { code: "ERR_CANCELED" }),
    );

    const client = createClient();
    await expect(
      client.createDeployment({ name: "test" }, abortedSignal()),
    ).rejects.toThrow();

    const call = mockRequest.mock.calls[0][0] as Record<string, unknown>;
    expect(call.signal).toBeDefined();
  });

  it("updateDeployment forwards signal to axios", async () => {
    mockRequest.mockRejectedValue(
      Object.assign(new Error("canceled"), { code: "ERR_CANCELED" }),
    );

    const client = createClient();
    await expect(
      client.updateDeployment(
        ContentID("c-1"),
        { title: "test" },
        abortedSignal(),
      ),
    ).rejects.toThrow();

    const call = mockRequest.mock.calls[0][0] as Record<string, unknown>;
    expect(call.signal).toBeDefined();
  });

  it("getEnvVars forwards signal to axios", async () => {
    mockRequest.mockRejectedValue(
      Object.assign(new Error("canceled"), { code: "ERR_CANCELED" }),
    );

    const client = createClient();
    await expect(
      client.getEnvVars(ContentID("c-1"), abortedSignal()),
    ).rejects.toThrow();

    const call = mockRequest.mock.calls[0][0] as Record<string, unknown>;
    expect(call.signal).toBeDefined();
  });

  it("setEnvVars forwards signal to axios", async () => {
    mockRequest.mockRejectedValue(
      Object.assign(new Error("canceled"), { code: "ERR_CANCELED" }),
    );

    const client = createClient();
    await expect(
      client.setEnvVars(ContentID("c-1"), { FOO: "bar" }, abortedSignal()),
    ).rejects.toThrow();

    const call = mockRequest.mock.calls[0][0] as Record<string, unknown>;
    expect(call.signal).toBeDefined();
  });

  it("uploadBundle forwards signal to axios", async () => {
    mockRequest.mockRejectedValue(
      Object.assign(new Error("canceled"), { code: "ERR_CANCELED" }),
    );

    const client = createClient();
    await expect(
      client.uploadBundle(
        ContentID("c-1"),
        () => Readable.from(Buffer.from([1, 2])),
        2,
        "x==",
        abortedSignal(),
      ),
    ).rejects.toThrow();

    const call = mockRequest.mock.calls[0][0] as Record<string, unknown>;
    expect(call.signal).toBeDefined();
  });

  it("downloadBundle forwards signal to axios", async () => {
    mockRequest.mockRejectedValue(
      Object.assign(new Error("canceled"), { code: "ERR_CANCELED" }),
    );

    const client = createClient();
    await expect(
      client.downloadBundle(ContentID("c-1"), BundleID("b-1"), abortedSignal()),
    ).rejects.toThrow();

    const call = mockRequest.mock.calls[0][0] as Record<string, unknown>;
    expect(call.signal).toBeDefined();
  });

  it("deployBundle forwards signal to axios", async () => {
    mockRequest.mockRejectedValue(
      Object.assign(new Error("canceled"), { code: "ERR_CANCELED" }),
    );

    const client = createClient();
    await expect(
      client.deployBundle(ContentID("c-1"), BundleID("b-1"), abortedSignal()),
    ).rejects.toThrow();

    const call = mockRequest.mock.calls[0][0] as Record<string, unknown>;
    expect(call.signal).toBeDefined();
  });

  it("waitForTask checks signal at start of loop and forwards to axios", async () => {
    const client = createClient();
    await expect(
      client.waitForTask(TaskID("t-1"), 0, undefined, abortedSignal()),
    ).rejects.toThrow();
  });

  it("waitForTask continues polling until signal aborts", async () => {
    const controller = new AbortController();

    mockRequest
      .mockResolvedValueOnce(
        jsonResponse({
          id: "t-1",
          output: [],
          result: null,
          finished: false,
          code: 0,
          error: "",
          last: 0,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: "t-1",
          output: [],
          result: null,
          finished: false,
          code: 0,
          error: "",
          last: 0,
        }),
      )
      .mockImplementation(() => {
        controller.abort();
        return Promise.reject(
          Object.assign(new Error("canceled"), { code: "ERR_CANCELED" }),
        );
      });

    const client = createClient();
    await expect(
      client.waitForTask(TaskID("t-1"), 0, undefined, controller.signal),
    ).rejects.toThrow();

    expect(mockRequest).toHaveBeenCalledTimes(3);
  });

  it("validateDeployment forwards signal to axios", async () => {
    mockRequest.mockRejectedValue(
      Object.assign(new Error("canceled"), { code: "ERR_CANCELED" }),
    );

    const client = createClient();
    await expect(
      client.validateDeployment(ContentID("c-1"), abortedSignal()),
    ).rejects.toThrow();

    const call = mockRequest.mock.calls[0][0] as Record<string, unknown>;
    expect(call.signal).toBeDefined();
  });

  it("getIntegrations forwards signal to axios", async () => {
    mockRequest.mockRejectedValue(
      Object.assign(new Error("canceled"), { code: "ERR_CANCELED" }),
    );

    const client = createClient();
    await expect(client.getIntegrations(abortedSignal())).rejects.toThrow();

    const call = mockRequest.mock.calls[0][0] as Record<string, unknown>;
    expect(call.signal).toBeDefined();
  });

  it("getSettings forwards signal to all 8 requests", async () => {
    mockRequest.mockRejectedValue(
      Object.assign(new Error("canceled"), { code: "ERR_CANCELED" }),
    );

    const client = createClient();
    await expect(
      client.getSettings(undefined, abortedSignal()),
    ).rejects.toThrow();

    // All 8 requests should have been initiated with the signal
    expect(mockRequest).toHaveBeenCalled();
    for (const call of mockRequest.mock.calls) {
      const config = call[0] as Record<string, unknown>;
      expect(config.signal).toBeDefined();
    }
  });
});

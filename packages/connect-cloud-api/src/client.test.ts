// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectCloudAPI } from "./client.js";
import {
  ContentID,
  ContentAccess,
  ContentType,
  PublishResult,
} from "./types.js";
import type {
  Account,
  AccountListResponse,
  AuthorizationRequest,
  AuthorizationResponse,
  ContentResponse,
  CreateContentRequest,
  Revision,
  UpdateContentRequest,
  UserResponse,
} from "./types.js";

// ---------------------------------------------------------------------------
// Mock axios — simulates real axios throw behavior on non-2xx
// ---------------------------------------------------------------------------

const mockRequest = vi.fn();

vi.mock("axios", () => {
  // Store request interceptors so we can apply them
  const requestInterceptors: Array<
    (config: Record<string, unknown>) => Record<string, unknown>
  > = [];

  async function request(config: Record<string, unknown>) {
    // Apply request interceptors
    let processedConfig = { ...config };
    for (const interceptor of requestInterceptors) {
      processedConfig = interceptor(processedConfig);
    }

    const resp = await mockRequest(processedConfig);
    const validate =
      (processedConfig.validateStatus as
        | ((s: number) => boolean)
        | undefined) ?? ((s: number) => s >= 200 && s < 300);
    if (!validate(resp.status as number)) {
      throw Object.assign(
        new Error(`Request failed with status code ${resp.status}`),
        { isAxiosError: true, response: resp },
      );
    }
    return resp;
  }

  return {
    default: {
      create: vi.fn(() => ({
        request,
        get: (url: string, config?: Record<string, unknown>) =>
          request({ method: "GET", url, ...config }),
        post: (url: string, data?: unknown, config?: Record<string, unknown>) =>
          request({ method: "POST", url, data, ...config }),
        patch: (
          url: string,
          data?: unknown,
          config?: Record<string, unknown>,
        ) => request({ method: "PATCH", url, data, ...config }),
        interceptors: {
          request: {
            use: (
              fn: (config: Record<string, unknown>) => Record<string, unknown>,
            ) => {
              requestInterceptors.push(fn);
            },
          },
        },
      })),
      post: vi.fn(
        async (
          url: string,
          data?: unknown,
          config?: Record<string, unknown>,
        ) => {
          const resp = await mockRequest({
            method: "POST",
            url,
            data,
            ...config,
          });
          const validate = (s: number) => s >= 200 && s < 300;
          if (!validate(resp.status as number)) {
            throw Object.assign(
              new Error(`Request failed with status code ${resp.status}`),
              { isAxiosError: true, response: resp },
            );
          }
          return resp;
        },
      ),
      isAxiosError: (err: unknown): boolean =>
        typeof err === "object" &&
        err !== null &&
        (err as Record<string, unknown>).isAxiosError === true,
    },
  };
});

// Re-import axios so we can inspect axios.create calls
import axios from "axios";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = "https://api.connect.posit.cloud";
const ACCESS_TOKEN = "test-access-token-123";

function createClient(): ConnectCloudAPI {
  return new ConnectCloudAPI({
    apiBaseUrl: BASE_URL,
    accessToken: ACCESS_TOKEN,
  });
}

function jsonResponse(
  body: unknown,
  status = 200,
  statusText = "OK",
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
    headers: { "content-type": "application/json" },
    config: {},
  };
}

function textResponse(
  body: string,
  status = 200,
  statusText = "OK",
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
    headers: {},
    config: {},
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
  it("sends Authorization: Bearer <accessToken> on every request", async () => {
    const userResponse: UserResponse = {};
    mockRequest.mockResolvedValue(jsonResponse(userResponse));

    const client = createClient();
    await client.getCurrentUser();

    // Auth header is set via request interceptor, verify it's in the request
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${ACCESS_TOKEN}`,
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// getCurrentUser
// ---------------------------------------------------------------------------

describe("getCurrentUser", () => {
  it("returns UserResponse", async () => {
    const userResponse: UserResponse = {};
    mockRequest.mockResolvedValue(jsonResponse(userResponse));

    const client = createClient();
    const result = await client.getCurrentUser();

    expect(result).toEqual(userResponse);
  });

  it("calls GET /v1/users/me", async () => {
    mockRequest.mockResolvedValue(jsonResponse({}));

    const client = createClient();
    await client.getCurrentUser();

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0];
    expect(call.url).toBe("/v1/users/me");
    expect(call.method).toBe("GET");
  });

  it("throws on non-2xx", async () => {
    mockRequest.mockResolvedValue(
      textResponse("err", 500, "Internal Server Error"),
    );

    const client = createClient();
    await expect(client.getCurrentUser()).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getAccounts
// ---------------------------------------------------------------------------

describe("getAccounts", () => {
  const accountsResponse: AccountListResponse = {
    data: [
      {
        id: "acct-1",
        name: "my-account",
        display_name: "My Account",
        permissions: ["admin"],
        license: {
          entitlements: {
            account_private_content_flag: { enabled: true },
          },
        },
      },
    ],
  };

  it("returns AccountListResponse", async () => {
    mockRequest.mockResolvedValue(jsonResponse(accountsResponse));

    const client = createClient();
    const result = await client.getAccounts();

    expect(result).toEqual(accountsResponse);
  });

  it("calls GET /v1/accounts?has_user_role=true", async () => {
    mockRequest.mockResolvedValue(jsonResponse(accountsResponse));

    const client = createClient();
    await client.getAccounts();

    const call = mockRequest.mock.calls[0][0];
    expect(call.url).toBe("/v1/accounts?has_user_role=true");
    expect(call.method).toBe("GET");
  });

  it("throws on non-2xx", async () => {
    mockRequest.mockResolvedValue(
      textResponse("err", 500, "Internal Server Error"),
    );

    const client = createClient();
    await expect(client.getAccounts()).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getAccount
// ---------------------------------------------------------------------------

describe("getAccount", () => {
  const account: Account = {
    id: "acct-1",
    name: "my-account",
    display_name: "My Account",
    permissions: ["admin"],
    license: null,
  };

  it("returns Account", async () => {
    mockRequest.mockResolvedValue(jsonResponse(account));

    const client = createClient();
    const result = await client.getAccount("acct-1");

    expect(result).toEqual(account);
  });

  it("calls GET /v1/accounts/:id", async () => {
    mockRequest.mockResolvedValue(jsonResponse(account));

    const client = createClient();
    await client.getAccount("acct-1");

    const call = mockRequest.mock.calls[0][0];
    expect(call.url).toBe("/v1/accounts/acct-1");
    expect(call.method).toBe("GET");
  });

  it("throws on non-2xx", async () => {
    mockRequest.mockResolvedValue(textResponse("not found", 404, "Not Found"));

    const client = createClient();
    await expect(client.getAccount("bad-id")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getContent
// ---------------------------------------------------------------------------

describe("getContent", () => {
  const contentId = ContentID("content-abc-123");
  const contentResponse: ContentResponse = {
    id: contentId,
    access: ContentAccess.ViewPrivateEditPrivate,
    next_revision: {
      id: "rev-1",
      publish_log_channel: "channel-1",
      publish_result: PublishResult.Success,
      source_bundle_id: "bundle-1",
      source_bundle_upload_url: "https://upload.example.com/bundle",
    },
  };

  it("returns ContentResponse", async () => {
    mockRequest.mockResolvedValue(jsonResponse(contentResponse));

    const client = createClient();
    const result = await client.getContent(contentId);

    expect(result).toEqual(contentResponse);
  });

  it("calls GET /v1/contents/:id", async () => {
    mockRequest.mockResolvedValue(jsonResponse(contentResponse));

    const client = createClient();
    await client.getContent(contentId);

    const call = mockRequest.mock.calls[0][0];
    expect(call.url).toBe(`/v1/contents/${contentId}`);
    expect(call.method).toBe("GET");
  });

  it("throws on non-2xx", async () => {
    mockRequest.mockResolvedValue(textResponse("not found", 404, "Not Found"));

    const client = createClient();
    await expect(client.getContent(contentId)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// createContent
// ---------------------------------------------------------------------------

describe("createContent", () => {
  const createRequest: CreateContentRequest = {
    title: "My App",
    content_type: ContentType.Quarto,
    account_id: "acct-1",
  };

  const contentResponse: ContentResponse = {
    id: ContentID("new-content-id"),
    access: ContentAccess.ViewPrivateEditPrivate,
  };

  it("POSTs the request body and returns ContentResponse", async () => {
    mockRequest.mockResolvedValue(jsonResponse(contentResponse));

    const client = createClient();
    const result = await client.createContent(createRequest);

    expect(result).toEqual(contentResponse);
    const call = mockRequest.mock.calls[0][0];
    expect(call.url).toBe("/v1/contents");
    expect(call.method).toBe("POST");
    expect(call.data).toEqual(createRequest);
  });

  it("throws on non-2xx", async () => {
    mockRequest.mockResolvedValue(textResponse("conflict", 409, "Conflict"));

    const client = createClient();
    await expect(client.createContent(createRequest)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// updateContent
// ---------------------------------------------------------------------------

describe("updateContent", () => {
  const contentId = ContentID("content-123");
  const updateRequest: UpdateContentRequest = {
    content_id: contentId,
    title: "Updated App",
    content_type: ContentType.Shiny,
  };

  const contentResponse: ContentResponse = {
    id: contentId,
    access: ContentAccess.ViewTeamEditPrivate,
  };

  it("PATCHes with new_bundle=true and returns ContentResponse", async () => {
    mockRequest.mockResolvedValue(jsonResponse(contentResponse));

    const client = createClient();
    const result = await client.updateContent(updateRequest);

    expect(result).toEqual(contentResponse);
    const call = mockRequest.mock.calls[0][0];
    expect(call.url).toBe(`/v1/contents/${contentId}?new_bundle=true`);
    expect(call.method).toBe("PATCH");
    // content_id should not be in the request body
    expect(call.data).not.toHaveProperty("content_id");
    expect(call.data.title).toBe("Updated App");
  });

  it("throws on non-2xx", async () => {
    mockRequest.mockResolvedValue(
      textResponse("bad request", 400, "Bad Request"),
    );

    const client = createClient();
    await expect(client.updateContent(updateRequest)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getAuthorization
// ---------------------------------------------------------------------------

describe("getAuthorization", () => {
  const authRequest: AuthorizationRequest = {
    resource_type: "content",
    resource_id: "content-123",
    permission: "publish",
  };

  const authResponse: AuthorizationResponse = {
    authorized: true,
    token: "auth-token-abc",
  };

  it("POSTs the request and returns AuthorizationResponse", async () => {
    mockRequest.mockResolvedValue(jsonResponse(authResponse));

    const client = createClient();
    const result = await client.getAuthorization(authRequest);

    expect(result).toEqual(authResponse);
    const call = mockRequest.mock.calls[0][0];
    expect(call.url).toBe("/v1/authorization");
    expect(call.method).toBe("POST");
    expect(call.data).toEqual(authRequest);
  });

  it("throws on non-2xx", async () => {
    mockRequest.mockResolvedValue(textResponse("forbidden", 403, "Forbidden"));

    const client = createClient();
    await expect(client.getAuthorization(authRequest)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getRevision
// ---------------------------------------------------------------------------

describe("getRevision", () => {
  const revision: Revision = {
    id: "rev-123",
    publish_log_channel: "channel-1",
    publish_result: PublishResult.Success,
    source_bundle_id: "bundle-1",
    source_bundle_upload_url: "https://upload.example.com/bundle",
  };

  it("returns Revision", async () => {
    mockRequest.mockResolvedValue(jsonResponse(revision));

    const client = createClient();
    const result = await client.getRevision("rev-123");

    expect(result).toEqual(revision);
  });

  it("calls GET /v1/revisions/:id", async () => {
    mockRequest.mockResolvedValue(jsonResponse(revision));

    const client = createClient();
    await client.getRevision("rev-123");

    const call = mockRequest.mock.calls[0][0];
    expect(call.url).toBe("/v1/revisions/rev-123");
    expect(call.method).toBe("GET");
  });

  it("throws on non-2xx", async () => {
    mockRequest.mockResolvedValue(textResponse("not found", 404, "Not Found"));

    const client = createClient();
    await expect(client.getRevision("bad-id")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// publishContent
// ---------------------------------------------------------------------------

describe("publishContent", () => {
  const contentId = ContentID("content-123");

  it("POSTs to /v1/contents/:id/publish and returns void", async () => {
    mockRequest.mockResolvedValue(jsonResponse(null, 200));

    const client = createClient();
    const result = await client.publishContent(contentId);

    expect(result).toBeUndefined();
    const call = mockRequest.mock.calls[0][0];
    expect(call.url).toBe("/v1/contents/content-123/publish");
    expect(call.method).toBe("POST");
  });

  it("throws on non-2xx", async () => {
    mockRequest.mockResolvedValue(
      textResponse("err", 500, "Internal Server Error"),
    );

    const client = createClient();
    await expect(client.publishContent(contentId)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// uploadBundle
// ---------------------------------------------------------------------------

describe("uploadBundle", () => {
  it("POSTs bundle to the upload URL with application/gzip content type", async () => {
    mockRequest.mockResolvedValue(jsonResponse(null, 200));

    const bundle = new Uint8Array([0x1f, 0x8b, 0x08]);
    const client = createClient();
    await client.uploadBundle("https://upload.example.com/presigned", bundle);

    // uploadBundle uses axios.post directly, not the instance
    expect(axios.post).toHaveBeenCalledWith(
      "https://upload.example.com/presigned",
      bundle,
      { headers: { "Content-Type": "application/gzip" } },
    );
  });

  it("throws on non-2xx", async () => {
    mockRequest.mockResolvedValue(
      textResponse("upload failed", 500, "Internal Server Error"),
    );

    const client = createClient();
    await expect(
      client.uploadBundle(
        "https://upload.example.com/presigned",
        new Uint8Array([1]),
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

import { CloudEnvironment } from "./types.js";

// Mock the auth module for token refresh tests
const mockExchangeToken = vi.fn().mockResolvedValue({
  access_token: "new-access-token",
  refresh_token: "new-refresh-token",
  expires_in: 3600,
  token_type: "Bearer",
  scope: "vivid",
});

vi.mock("./auth.js", () => ({
  CloudAuthClient: class MockCloudAuthClient {
    constructor(public environment: CloudEnvironment) {}
    exchangeToken = mockExchangeToken;
  },
}));

import { CloudAuthClient } from "./auth.js";

function createClientWithRefresh(
  onTokenRefresh?: (tokens: unknown) => Promise<void>,
): ConnectCloudAPI {
  return new ConnectCloudAPI({
    apiBaseUrl: BASE_URL,
    accessToken: ACCESS_TOKEN,
    refreshToken: "test-refresh-token",
    environment: CloudEnvironment.Production,
    onTokenRefresh,
  });
}

describe("Token refresh", () => {
  it("retries request after refreshing token on 401", async () => {
    const userResponse: UserResponse = {};
    // First call returns 401, second call succeeds
    mockRequest
      .mockResolvedValueOnce(textResponse("Unauthorized", 401, "Unauthorized"))
      .mockResolvedValueOnce(jsonResponse(userResponse));

    const client = createClientWithRefresh();
    const result = await client.getCurrentUser();

    expect(result).toEqual(userResponse);
    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockExchangeToken).toHaveBeenCalledWith({
      grant_type: "refresh_token",
      refresh_token: "test-refresh-token",
    });
  });

  it("uses new token for retry request", async () => {
    const userResponse: UserResponse = {};
    mockRequest
      .mockResolvedValueOnce(textResponse("Unauthorized", 401, "Unauthorized"))
      .mockResolvedValueOnce(jsonResponse(userResponse));

    const client = createClientWithRefresh();
    await client.getCurrentUser();

    // Second request should use the new token
    const secondCall = mockRequest.mock.calls[1][0];
    expect(secondCall.headers.Authorization).toBe("Bearer new-access-token");
  });

  it("calls onTokenRefresh callback after successful refresh", async () => {
    const userResponse: UserResponse = {};
    mockRequest
      .mockResolvedValueOnce(textResponse("Unauthorized", 401, "Unauthorized"))
      .mockResolvedValueOnce(jsonResponse(userResponse));

    const onTokenRefresh = vi.fn().mockResolvedValue(undefined);
    const client = createClientWithRefresh(onTokenRefresh);
    await client.getCurrentUser();

    expect(onTokenRefresh).toHaveBeenCalledWith({
      access_token: "new-access-token",
      refresh_token: "new-refresh-token",
      expires_in: 3600,
      token_type: "Bearer",
      scope: "vivid",
    });
  });

  it("does not retry on 401 when refresh is not configured", async () => {
    mockRequest.mockResolvedValue(
      textResponse("Unauthorized", 401, "Unauthorized"),
    );

    // Use client without refresh configuration
    const client = createClient();
    await expect(client.getCurrentUser()).rejects.toThrow();

    // Should only be called once (no retry)
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it("throws original error on non-401 errors", async () => {
    mockRequest.mockResolvedValue(
      textResponse("Server Error", 500, "Internal Server Error"),
    );

    const client = createClientWithRefresh();
    await expect(client.getCurrentUser()).rejects.toThrow();

    // Should only be called once (no retry for 500)
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it("throws when token refresh fails", async () => {
    mockRequest.mockResolvedValue(
      textResponse("Unauthorized", 401, "Unauthorized"),
    );
    mockExchangeToken.mockRejectedValueOnce(new Error("Refresh token expired"));

    const client = createClientWithRefresh();
    await expect(client.getCurrentUser()).rejects.toThrow(
      "Refresh token expired",
    );

    // Original request called once, no retry since refresh failed
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it("throws when retry also returns 401 after successful refresh", async () => {
    // Both original and retry return 401
    mockRequest
      .mockResolvedValueOnce(textResponse("Unauthorized", 401, "Unauthorized"))
      .mockResolvedValueOnce(textResponse("Unauthorized", 401, "Unauthorized"));

    const client = createClientWithRefresh();
    await expect(client.getCurrentUser()).rejects.toThrow();

    // Should be called twice (original + one retry), then give up
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });
});

// Copyright (C) 2026 by Posit Software, PBC.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectCloudAPI } from "./client.js";
import { ContentID } from "./types.js";
import type {
  AuthorizationRequest,
  CreateContentRequest,
  UpdateContentRequest,
} from "./types.js";

// ---------------------------------------------------------------------------
// Mock axios — same pattern as client.test.ts
// ---------------------------------------------------------------------------

const mockRequest = vi.fn();

vi.mock("axios", () => {
  const requestInterceptors: Array<
    (config: Record<string, unknown>) => Record<string, unknown>
  > = [];

  async function request(config: Record<string, unknown>) {
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
      isAxiosError: (err: unknown): boolean =>
        typeof err === "object" &&
        err !== null &&
        (err as Record<string, unknown>).isAxiosError === true,
    },
  };
});

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

interface Fixture {
  method: string;
  path: string;
  query: string;
  request_body: unknown | null;
  status_code: number;
  response_body: unknown | null;
}

const TESTDATA_DIR = join(__dirname, "..", "testdata");

function loadFixture(name: string): Fixture {
  const filePath = join(TESTDATA_DIR, `${name}.json`);
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as Fixture;
}

function fixtureExists(name: string): boolean {
  return existsSync(join(TESTDATA_DIR, `${name}.json`));
}

function jsonResponse(body: unknown, status = 200) {
  return {
    status,
    statusText: "OK",
    data: body,
    headers: { "content-type": "application/json" },
    config: {},
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = "https://api.connect.posit.cloud";
const ACCESS_TOKEN = "test-access-token";

function createClient(): ConnectCloudAPI {
  return new ConnectCloudAPI({
    apiBaseUrl: BASE_URL,
    accessToken: ACCESS_TOKEN,
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

afterEach(() => {
  vi.restoreAllMocks();
  mockRequest.mockReset();
});

// ---------------------------------------------------------------------------
// Check if testdata directory exists
// ---------------------------------------------------------------------------

const hasTestdata = existsSync(TESTDATA_DIR);

// ---------------------------------------------------------------------------
// Golden fixture tests
// ---------------------------------------------------------------------------

describe.skipIf(!hasTestdata)("Golden fixture tests", () => {
  describe.skipIf(!fixtureExists("get_current_user"))("getCurrentUser", () => {
    it("deserializes the golden fixture response", async () => {
      const fixture = loadFixture("get_current_user");
      mockRequest.mockResolvedValue(
        jsonResponse(fixture.response_body, fixture.status_code),
      );

      const client = createClient();
      const result = await client.getCurrentUser();

      expect(result).toEqual(fixture.response_body);
    });
  });

  describe.skipIf(!fixtureExists("get_accounts"))("getAccounts", () => {
    it("deserializes the golden fixture response", async () => {
      const fixture = loadFixture("get_accounts");
      mockRequest.mockResolvedValue(
        jsonResponse(fixture.response_body, fixture.status_code),
      );

      const client = createClient();
      const result = await client.getAccounts();

      expect(result).toEqual(fixture.response_body);
    });
  });

  describe.skipIf(!fixtureExists("get_account"))("getAccount", () => {
    it("deserializes the golden fixture response", async () => {
      const fixture = loadFixture("get_account");
      mockRequest.mockResolvedValue(
        jsonResponse(fixture.response_body, fixture.status_code),
      );

      const client = createClient();
      const result = await client.getAccount("test-account-id");

      expect(result).toEqual(fixture.response_body);
    });
  });

  describe.skipIf(!fixtureExists("get_content"))("getContent", () => {
    it("deserializes the golden fixture response", async () => {
      const fixture = loadFixture("get_content");
      mockRequest.mockResolvedValue(
        jsonResponse(fixture.response_body, fixture.status_code),
      );

      const client = createClient();
      const result = await client.getContent(ContentID("test-content-id"));

      expect(result).toEqual(fixture.response_body);
    });
  });

  describe.skipIf(!fixtureExists("create_content"))("createContent", () => {
    it("deserializes the golden fixture response", async () => {
      const fixture = loadFixture("create_content");
      mockRequest.mockResolvedValue(
        jsonResponse(fixture.response_body, fixture.status_code),
      );

      const client = createClient();
      const result = await client.createContent(
        fixture.request_body as CreateContentRequest,
      );

      expect(result).toEqual(fixture.response_body);
    });

    it("sends the correct request body", async () => {
      const fixture = loadFixture("create_content");
      mockRequest.mockResolvedValue(
        jsonResponse(fixture.response_body, fixture.status_code),
      );

      const client = createClient();
      await client.createContent(fixture.request_body as CreateContentRequest);

      const call = mockRequest.mock.calls[0][0];
      expect(call.data).toEqual(fixture.request_body);
    });
  });

  describe.skipIf(!fixtureExists("update_content"))("updateContent", () => {
    it("deserializes the golden fixture response", async () => {
      const fixture = loadFixture("update_content");
      mockRequest.mockResolvedValue(
        jsonResponse(fixture.response_body, fixture.status_code),
      );

      // The fixture request body won't have content_id (it's in the URL),
      // so we need to add it for the TS client.
      const responseBody = fixture.response_body as Record<string, unknown>;
      const contentId = ContentID(responseBody.id as string);
      const requestBody = (fixture.request_body ?? {}) as Record<
        string,
        unknown
      >;

      const client = createClient();
      const result = await client.updateContent({
        content_id: contentId,
        ...requestBody,
      } as UpdateContentRequest);

      expect(result).toEqual(fixture.response_body);
    });
  });

  describe.skipIf(!fixtureExists("get_authorization"))(
    "getAuthorization",
    () => {
      it("deserializes the golden fixture response", async () => {
        const fixture = loadFixture("get_authorization");
        mockRequest.mockResolvedValue(
          jsonResponse(fixture.response_body, fixture.status_code),
        );

        const client = createClient();
        const result = await client.getAuthorization(
          fixture.request_body as AuthorizationRequest,
        );

        expect(result).toEqual(fixture.response_body);
      });

      it("sends the correct request body", async () => {
        const fixture = loadFixture("get_authorization");
        mockRequest.mockResolvedValue(
          jsonResponse(fixture.response_body, fixture.status_code),
        );

        const client = createClient();
        await client.getAuthorization(
          fixture.request_body as AuthorizationRequest,
        );

        const call = mockRequest.mock.calls[0][0];
        expect(call.data).toEqual(fixture.request_body);
      });
    },
  );

  describe.skipIf(!fixtureExists("get_revision"))("getRevision", () => {
    it("deserializes the golden fixture response", async () => {
      const fixture = loadFixture("get_revision");
      mockRequest.mockResolvedValue(
        jsonResponse(fixture.response_body, fixture.status_code),
      );

      const client = createClient();
      const result = await client.getRevision("test-revision-id");

      expect(result).toEqual(fixture.response_body);
    });
  });

  describe.skipIf(!fixtureExists("publish_content"))("publishContent", () => {
    it("succeeds with the golden fixture response", async () => {
      const fixture = loadFixture("publish_content");
      mockRequest.mockResolvedValue(
        jsonResponse(fixture.response_body, fixture.status_code),
      );

      const client = createClient();
      // publishContent returns void on success
      await expect(
        client.publishContent(ContentID("test-content-id")),
      ).resolves.toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Meta-test: all fixture files are valid JSON with expected structure
// ---------------------------------------------------------------------------

describe.skipIf(!hasTestdata)("Fixture file integrity", () => {
  it("all .json files in testdata/ are valid fixtures", () => {
    const entries = readdirSync(TESTDATA_DIR).filter((f) =>
      f.endsWith(".json"),
    );
    if (entries.length === 0) {
      return; // No fixtures yet
    }

    for (const entry of entries) {
      const raw = readFileSync(join(TESTDATA_DIR, entry), "utf-8");
      const fixture = JSON.parse(raw) as Fixture;
      const name = basename(entry);

      expect(fixture.method, `${name}: method`).toBeTruthy();
      expect(fixture.path, `${name}: path`).toBeTruthy();
      expect(fixture.status_code, `${name}: status_code`).toBeGreaterThan(0);
    }
  });
});

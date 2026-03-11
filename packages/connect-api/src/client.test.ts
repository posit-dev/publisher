// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectAPI } from "./client.js";
import { ContentID, BundleID, TaskID } from "./types.js";
import type { UserDTO, ContentDetailsDTO } from "./types.js";

// ---------------------------------------------------------------------------
// Mock axios — simulates real axios throw behavior on non-2xx
// ---------------------------------------------------------------------------

const mockRequest = vi.fn();

vi.mock("axios", () => {
  async function request(config: Record<string, unknown>) {
    const resp = await mockRequest(config);
    const validate =
      (config.validateStatus as ((s: number) => boolean) | undefined) ??
      ((s: number) => s >= 200 && s < 300);
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
      })),
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

const BASE_URL = "https://connect.example.com";
const API_KEY = "test-api-key-123";

function createClient(): ConnectAPI {
  return new ConnectAPI({ url: BASE_URL, apiKey: API_KEY });
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

  it("sends application/gzip with raw bytes and returns full BundleDTO", async () => {
    const bundleResponse = {
      id: "bundle-42",
      content_guid: contentId,
      active: true,
      size: 1024,
    };
    mockRequest.mockResolvedValue(jsonResponse(bundleResponse));

    const bundle = new Uint8Array([0x1f, 0x8b, 0x08]);
    const client = createClient();
    const { data } = await client.uploadBundle(contentId, bundle);

    expect(data).toEqual(bundleResponse);
    const call = mockRequest.mock.calls[0][0];
    expect(call.url).toBe(`/__api__/v1/content/${contentId}/bundles`);
    expect(call.method).toBe("POST");
    expect(call.headers["Content-Type"]).toBe("application/gzip");
  });

  it("throws on non-2xx", async () => {
    mockRequest.mockResolvedValue(
      textResponse("too large", 413, "Payload Too Large"),
    );

    const client = createClient();
    await expect(
      client.uploadBundle(contentId, new Uint8Array([1])),
    ).rejects.toThrow();
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

  const urlResponseMap: Record<string, unknown> = {
    "/__api__/v1/user": userDTO,
    "/__api__/server_settings": general,
    "/__api__/server_settings/applications": application,
    "/__api__/server_settings/scheduler": scheduler,
    "/__api__/v1/server_settings/python": python,
    "/__api__/v1/server_settings/r": r,
    "/__api__/v1/server_settings/quarto": quarto,
  };

  function mockSettingsRoutes() {
    mockRequest.mockImplementation((config: { url: string }) =>
      Promise.resolve(jsonResponse(urlResponseMap[config.url])),
    );
  }

  it("makes 7 request calls to the correct URLs", async () => {
    mockSettingsRoutes();

    const client = createClient();
    await client.getSettings();

    expect(mockRequest).toHaveBeenCalledTimes(7);

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
  });
});

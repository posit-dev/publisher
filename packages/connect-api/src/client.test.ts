// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectClient } from "./client.js";
import {
  AuthenticationError,
  ConnectRequestError,
  DeploymentValidationError,
  TaskError,
} from "./errors.js";
import type {
  BundleID,
  ContentID,
  TaskID,
  UserDTO,
  ContentDetailsDTO,
} from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = "https://connect.example.com";
const API_KEY = "test-api-key-123";

function createClient(): ConnectClient {
  return new ConnectClient({ url: BASE_URL, apiKey: API_KEY });
}

function jsonResponse(body: unknown, status = 200, statusText = "OK"): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(body: string, status = 200, statusText = "OK"): Response {
  return new Response(body, { status, statusText });
}

function binaryResponse(data: Uint8Array, status = 200): Response {
  return new Response(data as unknown as BodyInit, { status, statusText: "OK" });
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

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Cross-cutting: Authorization header
// ---------------------------------------------------------------------------

describe("Authorization header", () => {
  it("sends Authorization: Key <apiKey> on every request", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(validUserDTO()));
    globalThis.fetch = fetchSpy;

    const client = createClient();
    await client.getCurrentUser();

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [, init] = fetchSpy.mock.calls[0];
    expect(init.headers.Authorization).toBe(`Key ${API_KEY}`);
  });
});

// ---------------------------------------------------------------------------
// testAuthentication
// ---------------------------------------------------------------------------

describe("testAuthentication", () => {
  it("returns user with guid mapped to id on success", async () => {
    const dto = validUserDTO();
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(dto));

    const client = createClient();
    const result = await client.testAuthentication();

    expect(result.error).toBeNull();
    expect(result.user).toEqual({
      id: dto.guid,
      username: dto.username,
      first_name: dto.first_name,
      last_name: dto.last_name,
      email: dto.email,
    });
  });

  it("throws AuthenticationError on 401", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ error: "Unauthorized" }, 401, "Unauthorized"),
      );

    const client = createClient();
    await expect(client.testAuthentication()).rejects.toThrow(
      AuthenticationError,
    );
  });

  it("throws AuthenticationError when user is locked", async () => {
    const dto = validUserDTO({ locked: true });
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(dto));

    const client = createClient();
    await expect(client.testAuthentication()).rejects.toThrow(
      /user account publisher1 is locked/,
    );
  });

  it("throws AuthenticationError when user is not confirmed", async () => {
    const dto = validUserDTO({ confirmed: false });
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(dto));

    const client = createClient();
    await expect(client.testAuthentication()).rejects.toThrow(
      /user account publisher1 is not confirmed/,
    );
  });

  it("throws AuthenticationError when user is a viewer", async () => {
    const dto = validUserDTO({ user_role: "viewer" });
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(dto));

    const client = createClient();
    await expect(client.testAuthentication()).rejects.toThrow(
      /does not have permission to publish content/,
    );
  });

  it("accepts administrator role", async () => {
    const dto = validUserDTO({ user_role: "administrator" });
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(dto));

    const client = createClient();
    const result = await client.testAuthentication();
    expect(result.user).not.toBeNull();
    expect(result.error).toBeNull();
  });

  it("throws AuthenticationError with generic message on non-JSON error body", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(textResponse("not json", 403, "Forbidden"));

    const client = createClient();
    await expect(client.testAuthentication()).rejects.toThrow(
      AuthenticationError,
    );
  });
});

// ---------------------------------------------------------------------------
// getCurrentUser
// ---------------------------------------------------------------------------

describe("getCurrentUser", () => {
  it("maps guid to id and returns User", async () => {
    const dto = validUserDTO();
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(dto));

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

  it("throws ConnectRequestError on non-2xx", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(textResponse("err", 500, "Internal Server Error"));

    const client = createClient();
    await expect(client.getCurrentUser()).rejects.toThrow(ConnectRequestError);
  });

  it("calls GET /__api__/v1/user", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(validUserDTO()));
    globalThis.fetch = fetchSpy;

    const client = createClient();
    await client.getCurrentUser();

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/__api__/v1/user`);
    expect(init.method).toBe("GET");
  });
});

// ---------------------------------------------------------------------------
// contentDetails
// ---------------------------------------------------------------------------

describe("contentDetails", () => {
  const contentId = "content-guid-abc" as ContentID;
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
    dashboard_url: "https://connect.example.com/connect/#/apps/content-guid-abc",
    app_role: "owner",
    id: "42",
  };

  it("returns the full content details DTO", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(detailsDTO));

    const client = createClient();
    const result = await client.contentDetails(contentId);

    expect(result).toEqual(detailsDTO);
  });

  it("uses contentId in the URL path", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(detailsDTO));
    globalThis.fetch = fetchSpy;

    const client = createClient();
    await client.contentDetails(contentId);

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/__api__/v1/content/${contentId}`);
  });

  it("throws ConnectRequestError on non-2xx", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(textResponse("not found", 404, "Not Found"));

    const client = createClient();
    await expect(client.contentDetails(contentId)).rejects.toThrow(
      ConnectRequestError,
    );
  });
});

// ---------------------------------------------------------------------------
// createDeployment
// ---------------------------------------------------------------------------

describe("createDeployment", () => {
  it("POSTs the body and returns the guid as ContentID", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse({ guid: "new-content-guid" }));
    globalThis.fetch = fetchSpy;

    const client = createClient();
    const id = await client.createDeployment({ name: "my-app" });

    expect(id).toBe("new-content-guid");
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/__api__/v1/content`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ name: "my-app" });
  });

  it("throws ConnectRequestError on non-2xx", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(textResponse("conflict", 409, "Conflict"));

    const client = createClient();
    await expect(client.createDeployment({ name: "dup" })).rejects.toThrow(
      ConnectRequestError,
    );
  });
});

// ---------------------------------------------------------------------------
// updateDeployment
// ---------------------------------------------------------------------------

describe("updateDeployment", () => {
  const contentId = "content-123" as ContentID;

  it("PATCHes the content and returns void", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({}, 200));
    globalThis.fetch = fetchSpy;

    const client = createClient();
    const result = await client.updateDeployment(contentId, {
      title: "New Title",
    });

    expect(result).toBeUndefined();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/__api__/v1/content/${contentId}`);
    expect(init.method).toBe("PATCH");
  });

  it("throws ConnectRequestError on non-2xx", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(textResponse("bad request", 400, "Bad Request"));

    const client = createClient();
    await expect(
      client.updateDeployment(contentId, { title: "x" }),
    ).rejects.toThrow(ConnectRequestError);
  });
});

// ---------------------------------------------------------------------------
// getEnvVars
// ---------------------------------------------------------------------------

describe("getEnvVars", () => {
  const contentId = "content-123" as ContentID;

  it("returns an array of environment variable names", async () => {
    const envNames = ["DATABASE_URL", "SECRET_KEY"];
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(envNames));

    const client = createClient();
    const result = await client.getEnvVars(contentId);

    expect(result).toEqual(envNames);
  });

  it("calls the correct URL", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse([]));
    globalThis.fetch = fetchSpy;

    const client = createClient();
    await client.getEnvVars(contentId);

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(
      `${BASE_URL}/__api__/v1/content/${contentId}/environment`,
    );
  });
});

// ---------------------------------------------------------------------------
// setEnvVars
// ---------------------------------------------------------------------------

describe("setEnvVars", () => {
  const contentId = "content-123" as ContentID;

  it("converts Record to [{name,value}] array in the body", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204, statusText: "No Content" }));
    globalThis.fetch = fetchSpy;

    const client = createClient();
    await client.setEnvVars(contentId, { FOO: "bar", BAZ: "qux" });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(
      `${BASE_URL}/__api__/v1/content/${contentId}/environment`,
    );
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual([
      { name: "FOO", value: "bar" },
      { name: "BAZ", value: "qux" },
    ]);
  });

  it("throws ConnectRequestError on non-2xx", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(textResponse("error", 500, "Internal Server Error"));

    const client = createClient();
    await expect(
      client.setEnvVars(contentId, { KEY: "val" }),
    ).rejects.toThrow(ConnectRequestError);
  });
});

// ---------------------------------------------------------------------------
// uploadBundle
// ---------------------------------------------------------------------------

describe("uploadBundle", () => {
  const contentId = "content-123" as ContentID;

  it("sends application/gzip with raw bytes and returns BundleID", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: "bundle-42" }));
    globalThis.fetch = fetchSpy;

    const data = new Uint8Array([0x1f, 0x8b, 0x08]);
    const client = createClient();
    const bundleId = await client.uploadBundle(contentId, data);

    expect(bundleId).toBe("bundle-42");
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/__api__/v1/content/${contentId}/bundles`);
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/gzip");
  });

  it("throws ConnectRequestError on non-2xx", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(textResponse("too large", 413, "Payload Too Large"));

    const client = createClient();
    await expect(
      client.uploadBundle(contentId, new Uint8Array([1])),
    ).rejects.toThrow(ConnectRequestError);
  });
});

// ---------------------------------------------------------------------------
// latestBundleId
// ---------------------------------------------------------------------------

describe("latestBundleId", () => {
  const contentId = "content-123" as ContentID;

  it("returns bundle_id from content details", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ bundle_id: "latest-bundle" }));

    const client = createClient();
    const bundleId = await client.latestBundleId(contentId);

    expect(bundleId).toBe("latest-bundle");
  });

  it("calls GET on /__api__/v1/content/:id", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse({ bundle_id: "b1" }));
    globalThis.fetch = fetchSpy;

    const client = createClient();
    await client.latestBundleId(contentId);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/__api__/v1/content/${contentId}`);
    expect(init.method).toBe("GET");
  });
});

// ---------------------------------------------------------------------------
// downloadBundle
// ---------------------------------------------------------------------------

describe("downloadBundle", () => {
  const contentId = "content-123" as ContentID;
  const bundleId = "bundle-42" as BundleID;

  it("returns a Uint8Array of the bundle data", async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    globalThis.fetch = vi.fn().mockResolvedValue(binaryResponse(data));

    const client = createClient();
    const result = await client.downloadBundle(contentId, bundleId);

    expect(result).toEqual(data);
  });

  it("calls the correct download URL", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(binaryResponse(new Uint8Array()));
    globalThis.fetch = fetchSpy;

    const client = createClient();
    await client.downloadBundle(contentId, bundleId);

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(
      `${BASE_URL}/__api__/v1/content/${contentId}/bundles/${bundleId}/download`,
    );
  });

  it("throws ConnectRequestError on non-2xx", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(textResponse("not found", 404, "Not Found"));

    const client = createClient();
    await expect(
      client.downloadBundle(contentId, bundleId),
    ).rejects.toThrow(ConnectRequestError);
  });
});

// ---------------------------------------------------------------------------
// deployBundle
// ---------------------------------------------------------------------------

describe("deployBundle", () => {
  const contentId = "content-123" as ContentID;
  const bundleId = "bundle-42" as BundleID;

  it("POSTs {bundle_id} and returns task_id", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse({ task_id: "task-99" }));
    globalThis.fetch = fetchSpy;

    const client = createClient();
    const taskId = await client.deployBundle(contentId, bundleId);

    expect(taskId).toBe("task-99");
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/__api__/v1/content/${contentId}/deploy`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ bundle_id: bundleId });
  });

  it("throws ConnectRequestError on non-2xx", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(textResponse("err", 500, "Internal Server Error"));

    const client = createClient();
    await expect(
      client.deployBundle(contentId, bundleId),
    ).rejects.toThrow(ConnectRequestError);
  });
});

// ---------------------------------------------------------------------------
// waitForTask
// ---------------------------------------------------------------------------

describe("waitForTask", () => {
  const taskId = "task-99" as TaskID;

  it("returns {finished: true} when task completes without error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
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

    expect(result).toEqual({ finished: true });
  });

  it("throws TaskError when task finishes with an error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
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
    const err = await client
      .waitForTask(taskId, 0)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TaskError);
    expect((err as TaskError).message).toMatch(/deployment failed/);
    expect((err as TaskError).code).toBe(1);
  });

  it("polls with first= query parameter and follows last cursor", async () => {
    const fetchSpy = vi
      .fn()
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
    globalThis.fetch = fetchSpy;

    const client = createClient();
    await client.waitForTask(taskId, 0);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const [url1] = fetchSpy.mock.calls[0];
    const [url2] = fetchSpy.mock.calls[1];
    expect(url1).toBe(`${BASE_URL}/__api__/v1/tasks/${taskId}?first=0`);
    expect(url2).toBe(`${BASE_URL}/__api__/v1/tasks/${taskId}?first=3`);
  });
});

// ---------------------------------------------------------------------------
// validateDeployment
// ---------------------------------------------------------------------------

describe("validateDeployment", () => {
  const contentId = "content-123" as ContentID;

  it("returns void on 200", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(textResponse("OK", 200));

    const client = createClient();
    const result = await client.validateDeployment(contentId);

    expect(result).toBeUndefined();
  });

  it("returns void on 404 (acceptable)", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(textResponse("not found", 404, "Not Found"));

    const client = createClient();
    const result = await client.validateDeployment(contentId);

    expect(result).toBeUndefined();
  });

  it("throws DeploymentValidationError on 500", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      textResponse("server error", 500, "Internal Server Error"),
    );

    const client = createClient();
    await expect(client.validateDeployment(contentId)).rejects.toThrow(
      DeploymentValidationError,
    );
  });

  it("throws DeploymentValidationError on 502", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(textResponse("bad gateway", 502, "Bad Gateway"));

    const client = createClient();
    await expect(client.validateDeployment(contentId)).rejects.toThrow(
      DeploymentValidationError,
    );
  });

  it("calls GET /content/:id/", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(textResponse("OK", 200));
    globalThis.fetch = fetchSpy;

    const client = createClient();
    await client.validateDeployment(contentId);

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/content/${contentId}/`);
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
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(integrations));

    const client = createClient();
    const result = await client.getIntegrations();

    expect(result).toEqual(integrations);
  });

  it("calls GET /__api__/v1/oauth/integrations", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse([]));
    globalThis.fetch = fetchSpy;

    const client = createClient();
    await client.getIntegrations();

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/__api__/v1/oauth/integrations`);
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

  it("makes 7 fetch calls to the correct URLs", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(userDTO))
      .mockResolvedValueOnce(jsonResponse(general))
      .mockResolvedValueOnce(jsonResponse(application))
      .mockResolvedValueOnce(jsonResponse(scheduler))
      .mockResolvedValueOnce(jsonResponse(python))
      .mockResolvedValueOnce(jsonResponse(r))
      .mockResolvedValueOnce(jsonResponse(quarto));
    globalThis.fetch = fetchSpy;

    const client = createClient();
    await client.getSettings();

    expect(fetchSpy).toHaveBeenCalledTimes(7);

    const urls = fetchSpy.mock.calls.map(
      (call: unknown[]) => call[0] as string,
    );
    expect(urls).toEqual([
      `${BASE_URL}/__api__/v1/user`,
      `${BASE_URL}/__api__/server_settings`,
      `${BASE_URL}/__api__/server_settings/applications`,
      `${BASE_URL}/__api__/server_settings/scheduler`,
      `${BASE_URL}/__api__/v1/server_settings/python`,
      `${BASE_URL}/__api__/v1/server_settings/r`,
      `${BASE_URL}/__api__/v1/server_settings/quarto`,
    ]);
  });

  it("returns an AllSettings composite object", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(userDTO))
      .mockResolvedValueOnce(jsonResponse(general))
      .mockResolvedValueOnce(jsonResponse(application))
      .mockResolvedValueOnce(jsonResponse(scheduler))
      .mockResolvedValueOnce(jsonResponse(python))
      .mockResolvedValueOnce(jsonResponse(r))
      .mockResolvedValueOnce(jsonResponse(quarto));
    globalThis.fetch = globalThis.fetch;

    const client = createClient();
    const settings = await client.getSettings();

    expect(settings.General).toEqual(general);
    expect(settings.user).toEqual(userDTO);
    expect(settings.application).toEqual(application);
    expect(settings.scheduler).toEqual(scheduler);
    expect(settings.python).toEqual(python);
    expect(settings.r).toEqual(r);
    expect(settings.quarto).toEqual(quarto);
  });
});

// Copyright (C) 2026 by Posit Software, PBC.

/**
 * Maps fixture filenames to their corresponding Connect API Swagger spec
 * endpoint (path + method + status code). Used by the validation tests to
 * look up the expected response schema for each fixture.
 */

export interface FixtureMapping {
  /** Fixture filename (relative to connect-responses/) */
  fixture: string;
  /** Swagger path, e.g. "/v1/user" */
  path: string;
  /** HTTP method */
  method: "get" | "post" | "put" | "patch" | "delete";
  /** Expected HTTP status code */
  status: number;
  /** Human-readable description for test output */
  description: string;
}

export const fixtureMappings: FixtureMapping[] = [
  // User endpoints — all variants share the same schema
  {
    fixture: "user.json",
    path: "/v1/user",
    method: "get",
    status: 200,
    description: "GET /user — active publisher user",
  },
  {
    fixture: "user-viewer.json",
    path: "/v1/user",
    method: "get",
    status: 200,
    description: "GET /user — viewer role user",
  },
  {
    fixture: "user-locked.json",
    path: "/v1/user",
    method: "get",
    status: 200,
    description: "GET /user — locked user",
  },
  {
    fixture: "user-unconfirmed.json",
    path: "/v1/user",
    method: "get",
    status: 200,
    description: "GET /user — unconfirmed user",
  },

  // Content endpoints
  {
    fixture: "content-create.json",
    path: "/v1/content",
    method: "post",
    status: 200,
    description: "POST /content — create content item",
  },
  {
    fixture: "content-details.json",
    path: "/v1/content/{guid}",
    method: "get",
    status: 200,
    description: "GET /content/{guid} — content details",
  },

  // Bundle endpoint
  {
    fixture: "bundle-upload.json",
    path: "/v1/content/{guid}/bundles",
    method: "post",
    status: 200,
    description: "POST /content/{guid}/bundles — upload bundle",
  },

  // Deploy endpoint
  {
    fixture: "deploy.json",
    path: "/v1/content/{guid}/deploy",
    method: "post",
    status: 202,
    description: "POST /content/{guid}/deploy — deploy content",
  },

  // Task endpoints
  {
    fixture: "task-finished.json",
    path: "/v1/tasks/{id}",
    method: "get",
    status: 200,
    description: "GET /tasks/{id} — finished task",
  },
  {
    fixture: "task-failed.json",
    path: "/v1/tasks/{id}",
    method: "get",
    status: 200,
    description: "GET /tasks/{id} — failed task",
  },

  // Environment variables endpoint
  {
    fixture: "environment.json",
    path: "/v1/content/{guid}/environment",
    method: "get",
    status: 200,
    description: "GET /content/{guid}/environment — environment variable names",
  },

  // Server settings (documented endpoints only)
  {
    fixture: "server-settings-python.json",
    path: "/v1/server_settings/python",
    method: "get",
    status: 200,
    description: "GET /server_settings/python — Python installations",
  },
  {
    fixture: "server-settings-r.json",
    path: "/v1/server_settings/r",
    method: "get",
    status: 200,
    description: "GET /server_settings/r — R installations",
  },
  {
    fixture: "server-settings-quarto.json",
    path: "/v1/server_settings/quarto",
    method: "get",
    status: 200,
    description: "GET /server_settings/quarto — Quarto installations",
  },

  // Integrations endpoint
  {
    fixture: "integrations.json",
    path: "/v1/oauth/integrations",
    method: "get",
    status: 200,
    description: "GET /oauth/integrations — OAuth integrations list",
  },
];

/**
 * Fixtures that are skipped because they correspond to undocumented internal
 * endpoints or generic error shapes not tied to a specific operation.
 */
export const skippedFixtures: { fixture: string; reason: string }[] = [
  {
    fixture: "server-settings.json",
    reason: "Undocumented internal endpoint — not in the public Swagger spec",
  },
  {
    fixture: "server-settings-applications.json",
    reason: "Undocumented internal endpoint — not in the public Swagger spec",
  },
  {
    fixture: "server-settings-scheduler.json",
    reason: "Undocumented internal endpoint — not in the public Swagger spec",
  },
  {
    fixture: "error-401.json",
    reason: "Generic error response — not tied to a specific endpoint schema",
  },
  {
    fixture: "error-403.json",
    reason: "Generic error response — not tied to a specific endpoint schema",
  },
  {
    fixture: "error-500.json",
    reason: "Generic error response — not tied to a specific endpoint schema",
  },
];

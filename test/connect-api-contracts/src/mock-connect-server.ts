// Copyright (C) 2026 by Posit Software, PBC.

/**
 * Mock Connect server for contract testing.
 *
 * This is a lightweight Node.js HTTP server that simulates the Posit Connect
 * API. It serves canned JSON responses from fixture files for every Connect
 * endpoint that Publisher's Go client calls. Routes are matched by HTTP method
 * and path regex, with more specific patterns registered before generic ones.
 *
 * Every incoming request (except control requests) is captured so that tests
 * can assert on the exact HTTP method, path, headers, and body that the Go
 * client sent. The captured requests are exposed via `/__test__/requests`.
 *
 * Tests can also register per-test response overrides via
 * `/__test__/response-override` to simulate error conditions or alternative
 * responses without modifying the default route table. Overrides take priority
 * over default routes and are cleared between tests.
 */
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface CapturedRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string | null;
}

interface RouteHandler {
  method: string;
  pattern: RegExp;
  status: number;
  response: unknown; // JSON object, string, Buffer, or null (for no-body responses)
  contentType?: string; // defaults to "application/json"
}

const FIXTURES_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "connect-responses",
);

function loadFixture(name: string): unknown {
  const content = readFileSync(resolve(FIXTURES_DIR, name), "utf-8");
  return JSON.parse(content);
}

// Minimal valid gzip stream (empty gzip file)
const DUMMY_GZIP_BYTES = Buffer.from([
  0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x03, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

export class MockConnectServer {
  private server: ReturnType<typeof createServer> | null = null;
  private captured: CapturedRequest[] = [];
  private routes: RouteHandler[] = [];
  private overrides: RouteHandler[] = [];
  private _port = 0;

  constructor() {
    this.registerDefaultRoutes();
  }

  get port(): number {
    return this._port;
  }

  get url(): string {
    return `http://localhost:${this._port}`;
  }

  private registerDefaultRoutes(): void {
    // Routes are matched first-match, so more specific patterns must come first.
    // Each entry: [method, pattern, status, fixture-or-response, contentType?]
    const routes: Array<[string, RegExp, number, unknown, string?]> = [
      // Authentication & User
      ["GET", /^\/__api__\/v1\/user$/, 200, loadFixture("user.json")],
      // OAuth Integrations
      [
        "GET",
        /^\/__api__\/v1\/oauth\/integrations$/,
        200,
        loadFixture("integrations.json"),
      ],
      // Content sub-resources (specific before generic)
      [
        "GET",
        /^\/__api__\/v1\/content\/[^/]+\/bundles\/[^/]+\/download$/,
        200,
        DUMMY_GZIP_BYTES,
        "application/gzip",
      ],
      [
        "POST",
        /^\/__api__\/v1\/content\/[^/]+\/bundles$/,
        200,
        loadFixture("bundle-upload.json"),
      ],
      [
        "GET",
        /^\/__api__\/v1\/content\/[^/]+\/environment$/,
        200,
        loadFixture("environment.json"),
      ],
      ["PATCH", /^\/__api__\/v1\/content\/[^/]+\/environment$/, 204, null],
      [
        "POST",
        /^\/__api__\/v1\/content\/[^/]+\/deploy$/,
        200,
        loadFixture("deploy.json"),
      ],
      // Content CRUD
      [
        "POST",
        /^\/__api__\/v1\/content$/,
        200,
        loadFixture("content-create.json"),
      ],
      ["PATCH", /^\/__api__\/v1\/content\/[^/]+$/, 204, null],
      [
        "GET",
        /^\/__api__\/v1\/content\/[^/]+$/,
        200,
        loadFixture("content-details.json"),
      ],
      // Tasks
      [
        "GET",
        /^\/__api__\/v1\/tasks\/[^?]+/,
        200,
        loadFixture("task-finished.json"),
      ],
      // Server Settings
      [
        "GET",
        /^\/__api__\/server_settings\/applications$/,
        200,
        loadFixture("server-settings-applications.json"),
      ],
      [
        "GET",
        /^\/__api__\/server_settings\/scheduler/,
        200,
        loadFixture("server-settings-scheduler.json"),
      ],
      [
        "GET",
        /^\/__api__\/server_settings$/,
        200,
        loadFixture("server-settings.json"),
      ],
      [
        "GET",
        /^\/__api__\/v1\/server_settings\/python$/,
        200,
        loadFixture("server-settings-python.json"),
      ],
      [
        "GET",
        /^\/__api__\/v1\/server_settings\/r$/,
        200,
        loadFixture("server-settings-r.json"),
      ],
      [
        "GET",
        /^\/__api__\/v1\/server_settings\/quarto$/,
        200,
        loadFixture("server-settings-quarto.json"),
      ],
      // Content Validation (non-API path)
      ["GET", /^\/content\/[^/]+\/$/, 200, "<html>OK</html>", "text/html"],
    ];

    for (const [method, pattern, status, response, contentType] of routes) {
      this.routes.push({ method, pattern, status, response, contentType });
    }
  }

  async start(port = 0): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => this.handleRequest(req, res));
      this.server.listen(port, "0.0.0.0", () => {
        const addr = this.server!.address();
        if (addr && typeof addr === "object") {
          this._port = addr.port;
        }
        resolve();
      });
      this.server.on("error", reject);
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const method = req.method ?? "GET";
    const path = req.url ?? "/";

    // Control endpoint: GET captured requests
    if (method === "GET" && path === "/__test__/requests") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(this.captured));
      return;
    }

    // Control endpoint: clear captured requests
    if (method === "DELETE" && path === "/__test__/requests") {
      this.captured = [];
      res.writeHead(204);
      res.end();
      return;
    }

    // Control endpoint: register a response override
    if (method === "POST" && path === "/__test__/response-override") {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
        this.overrides.push({
          method: body.method,
          pattern: new RegExp(body.pathPattern),
          status: body.status,
          response: body.body ?? null,
          contentType: body.contentType,
        });
        res.writeHead(204);
        res.end();
      });
      return;
    }

    // Control endpoint: clear all response overrides
    if (method === "DELETE" && path === "/__test__/response-overrides") {
      this.overrides = [];
      res.writeHead(204);
      res.end();
      return;
    }

    // Collect request body, then capture and route
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const bodyStr =
        chunks.length > 0 ? Buffer.concat(chunks).toString("utf-8") : null;

      // Flatten headers to Record<string, string>
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === "string") {
          headers[key] = value;
        } else if (Array.isArray(value)) {
          headers[key] = value.join(", ");
        }
      }

      // Capture the request
      this.captured.push({ method, path, headers, body: bodyStr });

      // Find matching route (overrides take priority over default routes)
      const route =
        this.overrides.find(
          (r) => r.method === method && r.pattern.test(path),
        ) ??
        this.routes.find((r) => r.method === method && r.pattern.test(path));

      if (route) {
        const contentType = route.contentType ?? "application/json";

        if (route.response === null || route.response === undefined) {
          // No-body response (e.g. 204)
          res.writeHead(route.status);
          res.end();
        } else if (Buffer.isBuffer(route.response)) {
          res.writeHead(route.status, { "Content-Type": contentType });
          res.end(route.response);
        } else if (typeof route.response === "string") {
          res.writeHead(route.status, { "Content-Type": contentType });
          res.end(route.response);
        } else {
          res.writeHead(route.status, { "Content-Type": contentType });
          res.end(JSON.stringify(route.response));
        }
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
      }
    });
  }
}

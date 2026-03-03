import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

const FIXTURES_DIR = resolve(__dirname, "fixtures", "connect-responses");

function loadFixture(name: string): unknown {
  const content = readFileSync(resolve(FIXTURES_DIR, name), "utf-8");
  return JSON.parse(content);
}

// Minimal valid gzip stream (empty gzip file)
const DUMMY_GZIP_BYTES = Buffer.from([
  0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03,
  0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

export class MockConnectServer {
  private server: ReturnType<typeof createServer> | null = null;
  private captured: CapturedRequest[] = [];
  private routes: RouteHandler[] = [];
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
    // Routes are matched by first match, so more specific patterns must come first.

    // --- Authentication & User ---

    // GET /__api__/v1/user — TestAuthentication, GetCurrentUser
    this.routes.push({
      method: "GET",
      pattern: /^\/__api__\/v1\/user$/,
      status: 200,
      response: loadFixture("user.json"),
    });

    // --- OAuth Integrations ---

    // GET /__api__/v1/oauth/integrations — GetIntegrations
    this.routes.push({
      method: "GET",
      pattern: /^\/__api__\/v1\/oauth\/integrations$/,
      status: 200,
      response: loadFixture("integrations.json"),
    });

    // --- Content (specific sub-resources first, then generic) ---

    // GET /__api__/v1/content/:id/bundles/:bid/download — DownloadBundle
    this.routes.push({
      method: "GET",
      pattern: /^\/__api__\/v1\/content\/[^/]+\/bundles\/[^/]+\/download$/,
      status: 200,
      response: DUMMY_GZIP_BYTES,
      contentType: "application/gzip",
    });

    // POST /__api__/v1/content/:id/bundles — UploadBundle
    this.routes.push({
      method: "POST",
      pattern: /^\/__api__\/v1\/content\/[^/]+\/bundles$/,
      status: 200,
      response: loadFixture("bundle-upload.json"),
    });

    // GET /__api__/v1/content/:id/environment — GetEnvVars
    this.routes.push({
      method: "GET",
      pattern: /^\/__api__\/v1\/content\/[^/]+\/environment$/,
      status: 200,
      response: loadFixture("environment.json"),
    });

    // PATCH /__api__/v1/content/:id/environment — SetEnvVars
    this.routes.push({
      method: "PATCH",
      pattern: /^\/__api__\/v1\/content\/[^/]+\/environment$/,
      status: 204,
      response: null,
    });

    // POST /__api__/v1/content/:id/deploy — DeployBundle
    this.routes.push({
      method: "POST",
      pattern: /^\/__api__\/v1\/content\/[^/]+\/deploy$/,
      status: 200,
      response: loadFixture("deploy.json"),
    });

    // POST /__api__/v1/content — CreateDeployment
    this.routes.push({
      method: "POST",
      pattern: /^\/__api__\/v1\/content$/,
      status: 200,
      response: loadFixture("content-create.json"),
    });

    // PATCH /__api__/v1/content/:id — UpdateDeployment
    this.routes.push({
      method: "PATCH",
      pattern: /^\/__api__\/v1\/content\/[^/]+$/,
      status: 204,
      response: null,
    });

    // GET /__api__/v1/content/:id — ContentDetails, LatestBundleID
    this.routes.push({
      method: "GET",
      pattern: /^\/__api__\/v1\/content\/[^/]+$/,
      status: 200,
      response: loadFixture("content-details.json"),
    });

    // --- Tasks ---

    // GET /__api__/v1/tasks/:id — WaitForTask (always returns finished)
    this.routes.push({
      method: "GET",
      pattern: /^\/__api__\/v1\/tasks\/[^?]+/,
      status: 200,
      response: loadFixture("task-finished.json"),
    });

    // --- Server Settings ---

    // GET /__api__/server_settings/applications — GetSettings (applications)
    this.routes.push({
      method: "GET",
      pattern: /^\/__api__\/server_settings\/applications$/,
      status: 200,
      response: loadFixture("server-settings-applications.json"),
    });

    // GET /__api__/server_settings/scheduler[/{appMode}] — GetSettings (scheduler)
    this.routes.push({
      method: "GET",
      pattern: /^\/__api__\/server_settings\/scheduler/,
      status: 200,
      response: loadFixture("server-settings-scheduler.json"),
    });

    // GET /__api__/server_settings — GetSettings (general)
    this.routes.push({
      method: "GET",
      pattern: /^\/__api__\/server_settings$/,
      status: 200,
      response: loadFixture("server-settings.json"),
    });

    // GET /__api__/v1/server_settings/python — GetSettings (python)
    this.routes.push({
      method: "GET",
      pattern: /^\/__api__\/v1\/server_settings\/python$/,
      status: 200,
      response: loadFixture("server-settings-python.json"),
    });

    // GET /__api__/v1/server_settings/r — GetSettings (r)
    this.routes.push({
      method: "GET",
      pattern: /^\/__api__\/v1\/server_settings\/r$/,
      status: 200,
      response: loadFixture("server-settings-r.json"),
    });

    // GET /__api__/v1/server_settings/quarto — GetSettings (quarto)
    this.routes.push({
      method: "GET",
      pattern: /^\/__api__\/v1\/server_settings\/quarto$/,
      status: 200,
      response: loadFixture("server-settings-quarto.json"),
    });

    // --- Content Validation (non-API path) ---

    // GET /content/:id/ — ValidateDeployment
    this.routes.push({
      method: "GET",
      pattern: /^\/content\/[^/]+\/$/,
      status: 200,
      response: "<html>OK</html>",
      contentType: "text/html",
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => this.handleRequest(req, res));
      this.server.listen(0, "localhost", () => {
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

    // Collect request body, then capture and route
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const bodyStr = chunks.length > 0 ? Buffer.concat(chunks).toString("utf-8") : null;

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

      // Find matching route
      const route = this.routes.find(
        (r) => r.method === method && r.pattern.test(path),
      );

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

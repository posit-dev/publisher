import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { URL } from "node:url";

export interface CapturedRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: string | null;
}

interface RouteHandler {
  method: string;
  pattern: RegExp;
  status: number;
  response: unknown;
  contentType?: string;
}

const FIXTURES_DIR = resolve(__dirname, "fixtures", "publisher-responses");

function loadFixture(name: string): unknown {
  const content = readFileSync(resolve(FIXTURES_DIR, name), "utf-8");
  return JSON.parse(content);
}

export class MockPublisherServer {
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

    // --- Configurations ---

    // GET /configurations — getAll
    this.routes.push({
      method: "GET",
      pattern: /^\/configurations$/,
      status: 200,
      response: loadFixture("configurations-list.json"),
    });

    // GET /configurations/:name — get single
    this.routes.push({
      method: "GET",
      pattern: /^\/configurations\/[^/]+$/,
      status: 200,
      response: loadFixture("configuration-single.json"),
    });

    // PUT /configurations/:name — createOrUpdate
    this.routes.push({
      method: "PUT",
      pattern: /^\/configurations\/[^/]+$/,
      status: 200,
      response: loadFixture("configuration-created.json"),
    });

    // DELETE /configurations/:name — delete
    this.routes.push({
      method: "DELETE",
      pattern: /^\/configurations\/[^/]+$/,
      status: 204,
      response: null,
    });

    // --- Credentials ---

    // POST /test-credentials — test
    this.routes.push({
      method: "POST",
      pattern: /^\/test-credentials$/,
      status: 200,
      response: loadFixture("test-credentials.json"),
    });

    // GET /credentials — list
    this.routes.push({
      method: "GET",
      pattern: /^\/credentials$/,
      status: 200,
      response: loadFixture("credentials-list.json"),
    });

    // POST /credentials — create
    this.routes.push({
      method: "POST",
      pattern: /^\/credentials$/,
      status: 201,
      response: loadFixture("credential-created.json"),
    });

    // DELETE /credentials — reset (must come before single-credential DELETE)
    // We distinguish by checking if there's a path segment after /credentials
    // The pattern for reset is exactly /credentials with no trailing segment
    // But we need the single DELETE to match /credentials/:guid
    // Since both are DELETE, we handle this in the route matching by ordering:
    // specific (with guid) first, then general (reset)

    // DELETE /credentials/:guid — delete single
    this.routes.push({
      method: "DELETE",
      pattern: /^\/credentials\/[^/]+$/,
      status: 204,
      response: null,
    });

    // DELETE /credentials — reset all
    this.routes.push({
      method: "DELETE",
      pattern: /^\/credentials$/,
      status: 200,
      response: loadFixture("credentials-reset.json"),
    });

    // GET /credentials/:guid — get single
    this.routes.push({
      method: "GET",
      pattern: /^\/credentials\/[^/]+$/,
      status: 200,
      response: loadFixture("credential-single.json"),
    });

    // --- Deployments ---

    // GET /deployments — getAll
    this.routes.push({
      method: "GET",
      pattern: /^\/deployments$/,
      status: 200,
      response: loadFixture("deployments-list.json"),
    });

    // POST /deployments — createNew
    this.routes.push({
      method: "POST",
      pattern: /^\/deployments$/,
      status: 200,
      response: loadFixture("deployment-created.json"),
    });

    // GET /deployments/:id — get single
    this.routes.push({
      method: "GET",
      pattern: /^\/deployments\/[^/]+$/,
      status: 200,
      response: loadFixture("deployment-single.json"),
    });

    // PATCH /deployments/:name — patch
    this.routes.push({
      method: "PATCH",
      pattern: /^\/deployments\/[^/]+$/,
      status: 200,
      response: loadFixture("deployment-patched.json"),
    });

    // DELETE /deployments/:name — delete
    this.routes.push({
      method: "DELETE",
      pattern: /^\/deployments\/[^/]+$/,
      status: 204,
      response: null,
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
    const rawUrl = req.url ?? "/";

    // Parse URL to separate path from query string
    const parsed = new URL(rawUrl, `http://localhost:${this._port}`);
    const path = parsed.pathname;
    const query: Record<string, string> = {};
    for (const [key, value] of parsed.searchParams.entries()) {
      query[key] = value;
    }

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
      this.captured.push({ method, path, query, headers, body: bodyStr });

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

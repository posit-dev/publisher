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
  response: unknown;
}

const FIXTURES_DIR = resolve(__dirname, "fixtures", "connect-responses");

function loadFixture(name: string): unknown {
  const content = readFileSync(resolve(FIXTURES_DIR, name), "utf-8");
  return JSON.parse(content);
}

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
    // GET /__api__/v1/user — TestAuthentication
    this.routes.push({
      method: "GET",
      pattern: /^\/__api__\/v1\/user$/,
      status: 200,
      response: loadFixture("user.json"),
    });

    // POST /__api__/v1/content — CreateDeployment
    this.routes.push({
      method: "POST",
      pattern: /^\/__api__\/v1\/content$/,
      status: 200,
      response: loadFixture("content-create.json"),
    });

    // GET /__api__/v1/content/:id — ContentDetails
    this.routes.push({
      method: "GET",
      pattern: /^\/__api__\/v1\/content\/[^/]+$/,
      status: 200,
      response: loadFixture("content-details.json"),
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
        res.writeHead(route.status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(route.response));
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
      }
    });
  }
}

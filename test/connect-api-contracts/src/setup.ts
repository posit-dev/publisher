import { execSync, spawn, type ChildProcess } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { GlobalSetupContext } from "vitest/node";
import { MockConnectServer } from "./mock-connect-server";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const FIXTURES_DIR = resolve(__dirname, "fixtures", "workspace");

let serverProcess: ChildProcess | null = null;
let mockServer: MockConnectServer | null = null;
let tempDir: string | null = null;

function getExecutablePath(): string {
  const result = execSync("just executable-path", {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  }).trim();
  return resolve(REPO_ROOT, result);
}

function waitForReady(apiBase: string, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const poll = async () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Server did not become ready within ${timeoutMs}ms`));
        return;
      }
      try {
        const res = await fetch(`${apiBase}/api/configurations`);
        if (res.ok) {
          resolve();
          return;
        }
      } catch {
        // Not ready yet
      }
      setTimeout(poll, 200);
    };
    poll();
  });
}

export async function setup({ provide }: GlobalSetupContext) {
  // 1. Start mock Connect server
  mockServer = new MockConnectServer();
  await mockServer.start();
  process.env.MOCK_CONNECT_URL = mockServer.url;

  console.log(`[setup] Mock Connect server running at ${mockServer.url}`);

  // 2. Copy fixture workspace to temp directory
  tempDir = mkdtempSync(join(tmpdir(), "publisher-connect-contract-"));
  cpSync(FIXTURES_DIR, tempDir, { recursive: true });
  process.env.WORKSPACE_DIR = tempDir;

  const backend = process.env.API_BACKEND ?? "go";

  if (backend === "go") {
    // 3. Find the Go binary
    const binaryPath = getExecutablePath();

    // 4. Spawn the Publisher server
    serverProcess = spawn(
      binaryPath,
      ["ui", tempDir, "--listen", "localhost:0", "--use-keychain=false"],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          HOME: tempDir,
          USERPROFILE: tempDir,
        },
      },
    );

    // 5. Capture the URL from stdout
    const apiBase = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timed out waiting for server URL on stdout"));
      }, 15_000);

      let buffer = "";
      serverProcess!.stdout!.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("http://")) {
            clearTimeout(timeout);
            resolve(trimmed.replace(/\/$/, ""));
            return;
          }
        }
      });

      serverProcess!.stderr!.on("data", (chunk: Buffer) => {
        process.stderr.write(`[publisher stderr] ${chunk.toString()}`);
      });

      serverProcess!.on("error", (err) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to spawn publisher: ${err.message}`));
      });

      serverProcess!.on("exit", (code) => {
        clearTimeout(timeout);
        if (code !== null && code !== 0) {
          reject(new Error(`Publisher exited with code ${code}`));
        }
      });
    });

    // 6. Wait for the server to be ready
    await waitForReady(apiBase);

    process.env.API_BASE = apiBase;
    process.env.__CLIENT_TYPE = "go";

    console.log(`[setup] Publisher server running at ${apiBase}`);
  } else {
    process.env.__CLIENT_TYPE = "typescript";
    console.log(`[setup] Using TypeScript direct client`);
  }

  console.log(`[setup] Workspace at ${tempDir}`);
}

export async function teardown() {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        serverProcess?.kill("SIGKILL");
        resolve();
      }, 5_000);
      serverProcess!.on("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    serverProcess = null;
  }

  if (mockServer) {
    await mockServer.stop();
    mockServer = null;
  }

  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }

  console.log("[teardown] Servers stopped and workspace cleaned up");
}

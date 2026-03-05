// Copyright (C) 2026 by Posit Software, PBC.

import { execSync, spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import type { GlobalSetupContext } from "vitest/node";
import { MockConnectServer } from "./mock-connect-server";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const HARNESS_DIR = resolve(__dirname, "..", "harness");

let harnessProcess: ChildProcess | null = null;
let mockServer: MockConnectServer | null = null;

function buildHarness(): string {
  const binaryPath = resolve(HARNESS_DIR, "harness");
  execSync(`go build -o ${binaryPath} ./test/connect-api-contracts/harness/`, {
    cwd: REPO_ROOT,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return binaryPath;
}

export async function setup({ provide }: GlobalSetupContext) {
  // 1. Start mock Connect server
  mockServer = new MockConnectServer();
  await mockServer.start();
  process.env.MOCK_CONNECT_URL = mockServer.url;

  console.log(`[setup] Mock Connect server running at ${mockServer.url}`);

  const backend = process.env.API_BACKEND ?? "go";

  if (backend === "go") {
    // 2. Build the harness binary
    console.log("[setup] Building harness binary...");
    const binaryPath = buildHarness();
    console.log(`[setup] Harness built at ${binaryPath}`);

    // 3. Spawn the harness
    harnessProcess = spawn(binaryPath, ["--listen", "localhost:0"], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    // 4. Capture the URL from stdout
    const apiBase = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timed out waiting for harness URL on stdout"));
      }, 15_000);

      let buffer = "";
      harnessProcess!.stdout!.on("data", (chunk: Buffer) => {
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

      harnessProcess!.stderr!.on("data", (chunk: Buffer) => {
        process.stderr.write(`[harness stderr] ${chunk.toString()}`);
      });

      harnessProcess!.on("error", (err) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to spawn harness: ${err.message}`));
      });

      harnessProcess!.on("exit", (code) => {
        clearTimeout(timeout);
        if (code !== null && code !== 0) {
          reject(new Error(`Harness exited with code ${code}`));
        }
      });
    });

    process.env.API_BASE = apiBase;
    process.env.__CLIENT_TYPE = "go";

    console.log(`[setup] Harness running at ${apiBase}`);
  } else {
    process.env.__CLIENT_TYPE = "typescript";
    console.log(`[setup] Using TypeScript direct client`);
  }
}

export async function teardown() {
  if (harnessProcess) {
    harnessProcess.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        harnessProcess?.kill("SIGKILL");
        resolve();
      }, 5_000);
      harnessProcess!.on("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    harnessProcess = null;
  }

  if (mockServer) {
    await mockServer.stop();
    mockServer = null;
  }

  console.log("[teardown] Servers stopped");
}

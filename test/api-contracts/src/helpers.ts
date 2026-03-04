import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { BackendClient } from "./client";
import { GoHttpClient } from "./clients/go-http-client";
import { TypeScriptDirectClient } from "./clients/typescript-direct-client";

// --- Client accessor ---

let _client: BackendClient | null = null;

export function getClient(): BackendClient {
  if (_client) return _client;

  const clientType = process.env.__CLIENT_TYPE ?? "go";
  if (clientType === "go") {
    const base = process.env.API_BASE;
    if (!base) {
      throw new Error(
        "API_BASE not set. Is the global setup running correctly?",
      );
    }
    _client = new GoHttpClient(base);
  } else {
    const dir = process.env.WORKSPACE_DIR;
    if (!dir) {
      throw new Error(
        "WORKSPACE_DIR not set. Is the global setup running correctly?",
      );
    }
    _client = new TypeScriptDirectClient(dir);
  }
  return _client;
}

export function getWorkspaceDir(): string {
  const dir = process.env.WORKSPACE_DIR;
  if (!dir) {
    throw new Error(
      "WORKSPACE_DIR not set. Is the global setup running correctly?",
    );
  }
  return dir;
}

// --- Workspace manipulation ---

function positPublishDir(): string {
  return join(getWorkspaceDir(), ".posit", "publish");
}

function deploymentsDir(): string {
  return join(positPublishDir(), "deployments");
}

/**
 * Write a configuration TOML file to the workspace's .posit/publish/ directory.
 */
export function seedConfigFile(name: string, content: string): void {
  const dir = positPublishDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.toml`), content, "utf-8");
}

/**
 * Write a deployment TOML file to the workspace's .posit/publish/deployments/ directory.
 */
export function seedDeploymentFile(name: string, content: string): void {
  const dir = deploymentsDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.toml`), content, "utf-8");
}

/**
 * Remove a configuration TOML file from the workspace.
 */
export function removeConfigFile(name: string): void {
  const path = join(positPublishDir(), `${name}.toml`);
  if (existsSync(path)) {
    rmSync(path);
  }
}

/**
 * Remove a deployment TOML file from the workspace.
 */
export function removeDeploymentFile(name: string): void {
  const path = join(deploymentsDir(), `${name}.toml`);
  if (existsSync(path)) {
    rmSync(path);
  }
}

/**
 * Write an arbitrary file to the workspace at the given relative path.
 */
export function seedWorkspaceFile(relativePath: string, content: string): void {
  const filePath = join(getWorkspaceDir(), relativePath);
  const dir = join(filePath, "..");
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, content, "utf-8");
}

/**
 * Remove an arbitrary file from the workspace.
 */
export function removeWorkspaceFile(relativePath: string): void {
  const filePath = join(getWorkspaceDir(), relativePath);
  if (existsSync(filePath)) {
    rmSync(filePath);
  }
}

/**
 * Remove the entire .posit/publish directory and re-create it empty.
 */
export function resetDotPosit(): void {
  const dir = positPublishDir();
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
  mkdirSync(dir, { recursive: true });
  mkdirSync(deploymentsDir(), { recursive: true });
}

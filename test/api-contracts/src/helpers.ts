import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

export function getApiBase(): string {
  const base = process.env.API_BASE;
  if (!base) {
    throw new Error(
      "API_BASE not set. Is the global setup running correctly?",
    );
  }
  return base;
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

// --- Fetch wrappers ---

export async function apiGet(path: string): Promise<Response> {
  return fetch(`${getApiBase()}${path}`);
}

export async function apiPost(
  path: string,
  body?: unknown,
): Promise<Response> {
  return fetch(`${getApiBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function apiPut(path: string, body?: unknown): Promise<Response> {
  return fetch(`${getApiBase()}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function apiPatch(
  path: string,
  body?: unknown,
): Promise<Response> {
  return fetch(`${getApiBase()}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function apiDelete(path: string): Promise<Response> {
  return fetch(`${getApiBase()}${path}`, {
    method: "DELETE",
  });
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

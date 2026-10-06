// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  allValidContentTypes,
  ConfigurationDetails,
  ContentType,
  PythonConfig,
  QuartoConfig,
} from "./api/types/configurations";
import {
  PreContentRecord,
  ProductType,
  ServerType,
} from "./api/types/contentRecords";
import { contentTypeFromAppMode } from "./bundler/appMode";
import { writeConfigToFile } from "./toml/configWriter";
import { createDeploymentRecord } from "./toml/deploymentWriter";
import { isRecord } from "./toml/tomlHelpers";
import { normalizeServerURL } from "./utils/serverUrl";

const SESSION_NAME = "connect-session";
const CONFIG_SCHEMA =
  "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json";

function record(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`Invalid bundle manifest: ${field} must be an object.`);
  }
  return value;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`Invalid bundle manifest: ${field} must be a string.`);
  }
  return value || undefined;
}

function pythonConfig(value: unknown): PythonConfig | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const python = record(value, "python");
  const manager =
    python.package_manager === null || python.package_manager === undefined
      ? {}
      : record(python.package_manager, "python.package_manager");
  return {
    version: optionalString(python.version, "python.version") ?? "",
    packageFile:
      optionalString(
        manager.package_file,
        "python.package_manager.package_file",
      ) ?? "requirements.txt",
    packageManager:
      optionalString(manager.name, "python.package_manager.name") ?? "pip",
  };
}

function quartoConfig(value: unknown): QuartoConfig | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const quarto = record(value, "quarto");
  const engines = quarto.engines;
  if (
    engines !== undefined &&
    (!Array.isArray(engines) ||
      !engines.every((engine): engine is string => typeof engine === "string"))
  ) {
    throw new Error(
      "Invalid bundle manifest: quarto.engines must be a list of strings.",
    );
  }
  return {
    version: optionalString(quarto.version, "quarto.version") ?? "",
    engines,
  };
}

function filePattern(filename: string): string {
  const parts = filename.split("/");
  if (
    /[\\\0]/.test(filename) ||
    /^[a-z]:/i.test(filename) ||
    parts.some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`Invalid bundle manifest file path: ${filename}`);
  }
  // Manifest filenames are literals; anchor them and escape Publisher's glob syntax.
  return "/" + filename.replace(/([*?[\]{}()!+@])/g, "\\$1");
}

function manifestEntrypoint(
  metadata: Record<string, unknown>,
  type: ContentType,
  filenames: string[],
): string {
  const entrypoint =
    optionalString(metadata.entrypoint, "metadata.entrypoint") ||
    optionalString(metadata.primary_rmd, "metadata.primary_rmd") ||
    optionalString(metadata.primary_html, "metadata.primary_html");
  if (entrypoint) {
    // Connect and Publisher both support Python module:object references.
    return entrypoint;
  }
  if (type === ContentType.R_SHINY) {
    const app = ["app.R", "server.R"].find((name) => filenames.includes(name));
    if (app) {
      return app;
    }
  }
  throw new Error("The bundle manifest does not identify an entrypoint.");
}

function configFromManifest(value: unknown): ConfigurationDetails {
  const manifest = record(value, "manifest");
  const metadata = record(manifest.metadata, "metadata");
  const appMode = optionalString(metadata.appmode, "metadata.appmode") ?? "";
  const mappedType = contentTypeFromAppMode(appMode);
  const type = allValidContentTypes.find(
    (candidate) => candidate === mappedType,
  );
  if (!type) {
    throw new Error(`Publisher does not support bundle app mode '${appMode}'.`);
  }
  const filenames = Object.keys(record(manifest.files, "files"));
  if (filenames.length === 0) {
    throw new Error("The bundle manifest contains no files.");
  }
  const rVersion = optionalString(manifest.platform, "platform");
  return {
    $schema: CONFIG_SCHEMA,
    productType: ProductType.CONNECT,
    type,
    entrypoint: manifestEntrypoint(metadata, type, filenames),
    files: filenames.map(filePattern),
    python: pythonConfig(manifest.python),
    r: rVersion
      ? { version: rVersion, packageFile: "renv.lock", packageManager: "renv" }
      : undefined,
    quarto: quartoConfig(manifest.quarto),
    validate: true,
  };
}

async function hasPublisherFiles(root: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (
        !entry.isDirectory() ||
        (await hasPublisherFiles(path.join(root, entry.name)))
      ) {
        return true;
      }
    }
    return false;
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

/** Bootstrap once; saved Publisher files and selection remain authoritative afterwards. */
export async function bootstrapConnectSession(
  rootDir: string,
  clientVersion: string,
): Promise<PreContentRecord | undefined> {
  const target = process.env.CONNECT_DEPLOY_TARGET_GUID;
  const server = process.env.CONNECT_SERVER;
  if (process.env.POSIT_PRODUCT !== "CONNECT" || !target || !server) {
    return undefined;
  }
  // Validate the address before writing either file, including for normal sign-in fallback.
  normalizeServerURL(server);
  if (await hasPublisherFiles(path.join(rootDir, ".posit", "publish"))) {
    return undefined;
  }
  let raw: string;
  try {
    raw = await fs.readFile(path.join(rootDir, "manifest.json"), "utf-8");
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
  const manifest: unknown = JSON.parse(raw);
  const config = configFromManifest(manifest);
  await writeConfigToFile(SESSION_NAME, ".", rootDir, config);
  return createDeploymentRecord({
    saveName: SESSION_NAME,
    projectDir: ".",
    rootDir,
    serverUrl: server,
    serverType: ServerType.CONNECT,
    configName: SESSION_NAME,
    contentId: target,
    clientVersion,
  });
}

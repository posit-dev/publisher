// Copyright (C) 2026 by Posit Software, PBC.

/**
 * @publisher/core — Public API
 *
 * This is the sole entry point for the core package. Only types,
 * errors, port interfaces, and use cases intended for external
 * consumption are exported here. Internal helpers are not exported.
 */

// Domain types
export type {
  AccessType,
  Configuration,
  ConfigurationSummary,
  ConnectAccess,
  ConnectAccessControl,
  ConnectCloudAccessControl,
  ConnectCloudSettings,
  ConnectKubernetes,
  ConnectRuntime,
  ConnectSettings,
  ContentType,
  Environment,
  Group,
  IntegrationRequest,
  JupyterConfig,
  OrganizationAccessType,
  ProductType,
  PythonConfig,
  QuartoConfig,
  RConfig,
  Schedule,
  User,
} from "./core/types.js";

// Domain errors
export {
  ConfigurationNotFoundError,
  ConfigurationReadError,
  ConfigurationValidationError,
} from "./core/errors.js";

// Port interfaces
export type { ConfigurationStore } from "./core/ports.js";

// Use cases
export { ListConfigurations } from "./use-cases/list-configurations.js";
export { GetConfiguration } from "./use-cases/get-configuration.js";
export { SaveConfiguration } from "./use-cases/save-configuration.js";

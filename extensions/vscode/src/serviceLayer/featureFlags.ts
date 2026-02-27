// Copyright (C) 2025 by Posit Software, PBC.

import { workspace } from "vscode";

export interface MigrationFlags {
  useTypeScriptConfigurations: boolean;
  // Future flags for additional service migrations:
  // useTypeScriptCredentials: boolean;
  // useTypeScriptInterpreters: boolean;
}

const defaultFlags: MigrationFlags = {
  useTypeScriptConfigurations: false,
};

// Programmatic overrides for testing
let overrides: Partial<MigrationFlags> | undefined;

export function setMigrationFlagOverrides(
  flags: Partial<MigrationFlags> | undefined,
) {
  overrides = flags;
}

export function getMigrationFlags(): MigrationFlags {
  const configuration = workspace.getConfiguration("positPublisher");

  const flags: MigrationFlags = {
    useTypeScriptConfigurations:
      overrides?.useTypeScriptConfigurations ??
      configuration.get<boolean>(
        "migration.useTypeScriptConfigurations",
        defaultFlags.useTypeScriptConfigurations,
      ),
  };

  return flags;
}

// Copyright (C) 2026 by Posit Software, PBC.

import { ContentRecordFile } from "../api/types/files";
import { getConfigPath } from "../toml/configDiscovery";
import { loadConfigFromFile } from "../toml/configLoader";
import { buildFileTree } from "./fileTree";
import { MatchList, STANDARD_EXCLUSIONS } from "./matcher";

/**
 * Build a file tree for a project directory, applying the file patterns
 * from a named configuration plus standard exclusions.
 *
 * Replaces the Go `GET /api/configurations/{name}/files` endpoint.
 */
export async function getConfigurationFiles(
  projectDir: string,
  configName: string,
): Promise<ContentRecordFile> {
  const configPath = getConfigPath(projectDir, configName);
  const config = await loadConfigFromFile(configPath, projectDir);

  const matchList = new MatchList(projectDir, STANDARD_EXCLUSIONS);

  const files = config.configuration.files ?? [];
  if (files.length > 0) {
    matchList.addFromFile(projectDir, configPath, files);
  }

  return buildFileTree(projectDir, matchList);
}

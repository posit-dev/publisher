// Copyright (C) 2023 by Posit Software, PBC.

import { Deployment } from 'src/api/types/deployments';
import { ManifestFile } from 'src/api/types/manifest';

export function pathToManifestFiles(paths: string[]): Record<string, ManifestFile> {
  const result: Record<string, ManifestFile> = {};
  paths.forEach(path => {
    result[path] = { checksum: '' };
  });
  return result;
}

export function deploymentToPaths(deployment: Deployment | undefined): string[] {
  if (deployment) {
    return Object.keys(deployment.manifest.files);
  }
  return [];
}

// Copyright (C) 2023 by Posit Software, PBC.

import { Deployment } from 'src/api/types/deployments';
import { ManifestFile } from 'src/api/types/manifest';

export function pathnamesToManifestFiles(pathnames: string[]): Record<string, ManifestFile> {
  const result: Record<string, ManifestFile> = {};
  pathnames.forEach(pathname => {
    result[pathname] = { checksum: '' };
  });
  return result;
}

export function deploymentToPathnames(deployment: Deployment | undefined): string[] {
  if (deployment) {
    return Object.keys(deployment.manifest.files);
  }
  return [];
}

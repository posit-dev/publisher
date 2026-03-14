// Copyright (C) 2026 by Posit Software, PBC.

import { Manifest } from "./types";

const KNOWN_SITE_CONFIG_FILES = [
  "_site.yml",
  "_site.yaml",
  "_bookdown.yml",
  "_bookdown.yaml",
];

export function newManifest(): Manifest {
  return {
    version: 1,
    metadata: { appmode: "" },
    packages: {},
    files: {},
  };
}

export function addFile(manifest: Manifest, path: string, md5: Buffer): void {
  manifest.files[path] = { checksum: md5.toString("hex") };

  // Detect site configuration files and update content category
  if (KNOWN_SITE_CONFIG_FILES.includes(path.toLowerCase())) {
    manifest.metadata.content_category = "site";
  }
}

export function manifestToJSON(manifest: Manifest): Buffer {
  // Match Go's json.Encoder: tab indentation, no HTML escaping
  const json = JSON.stringify(manifest, null, "\t") + "\n";
  return Buffer.from(json, "utf-8");
}

export function cloneManifest(manifest: Manifest): Manifest {
  return JSON.parse(JSON.stringify(manifest)) as Manifest;
}

export function getFilenames(manifest: Manifest): string[] {
  return Object.keys(manifest.files).sort();
}

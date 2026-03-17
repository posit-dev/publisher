// Copyright (C) 2026 by Posit Software, PBC.

export { createBundle } from "./bundler";
export { collectFiles } from "./collect";
export { createArchive } from "./archive";
export {
  newManifest,
  addFile,
  manifestToJSON,
  cloneManifest,
  getFilenames,
} from "./manifest";
export type {
  Manifest,
  ManifestMetadata,
  ManifestFile,
  ManifestPython,
  ManifestPythonPackageManager,
  ManifestJupyter,
  ManifestQuarto,
  ManifestEnvironment,
  ManifestPackage,
  ManifestIntegrationRequest,
  FileEntry,
  BundleOptions,
  BundleResult,
} from "./types";

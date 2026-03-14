// Copyright (C) 2026 by Posit Software, PBC.

// Manifest types matching Connect's expected manifest.json structure.

export type Manifest = {
  version: number;
  locale?: string;
  platform?: string; // R version
  metadata: ManifestMetadata;
  python?: ManifestPython;
  jupyter?: ManifestJupyter;
  quarto?: ManifestQuarto;
  environment?: ManifestEnvironment;
  packages: Record<string, ManifestPackage>;
  files: Record<string, ManifestFile>;
  integration_requests?: ManifestIntegrationRequest[];
};

export type ManifestMetadata = {
  appmode: string;
  content_category?: string;
  entrypoint?: string;
  primary_rmd?: string;
  primary_html?: string;
  has_parameters?: boolean;
};

export type ManifestFile = {
  checksum: string; // MD5 hex
};

export type ManifestPython = {
  version: string;
  package_manager: ManifestPythonPackageManager | null;
};

export type ManifestPythonPackageManager = {
  name: string;
  version?: string;
  package_file: string;
  allow_uv?: boolean;
};

export type ManifestJupyter = {
  hide_all_input: boolean;
  hide_tagged_input: boolean;
};

export type ManifestQuarto = {
  version: string;
  engines: string[];
};

export type ManifestEnvironment = {
  image: string;
  prebuilt: boolean;
  python?: { requires: string };
  r?: { requires: string };
};

export type ManifestPackage = {
  Source?: string;
  Repository?: string;
  description: Record<string, string>;
};

export type ManifestIntegrationRequest = {
  guid?: string;
  name?: string;
  description?: string;
  auth_type?: string;
  type?: string;
  config?: Record<string, unknown>;
};

// Bundler I/O types

export type FileEntry = {
  /** Path relative to project root, always using forward slashes */
  relativePath: string;
  /** Absolute filesystem path */
  absolutePath: string;
  /** Whether this is a directory */
  isDirectory: boolean;
  /** File size in bytes (0 for directories) */
  size: number;
};

export type BundleOptions = {
  /** Absolute path to the project directory, or to a single file */
  projectPath: string;
  /** Pre-built manifest (metadata, python/R/quarto config, packages, etc.) */
  manifest: Manifest;
  /** File include/exclude patterns from the config's `files` array */
  filePatterns?: string[];
};

export type BundleResult = {
  /** The tar.gz bundle contents */
  bundle: Buffer;
  /** The manifest with the `files` section populated */
  manifest: Manifest;
  /** Number of files included in the bundle */
  fileCount: number;
  /** Total uncompressed size of files in bytes */
  totalSize: number;
};

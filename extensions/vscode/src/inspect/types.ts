// Copyright (C) 2026 by Posit Software, PBC.

import { ContentType } from "src/api/types/configurations";

export interface InspectOptions {
  projectDir: string; // Absolute path to the project directory
  pythonPath?: string; // Optional Python executable path
  rPath?: string; // Optional R executable path
  entrypoint?: string; // Optional specific entrypoint filename
  recursive?: boolean; // Walk subdirectories
}

// Internal partial config before normalization fills in interpreter info.
// Detectors produce these; normalize() converts them to ConfigurationDetails.
export interface PartialConfig {
  type: ContentType;
  entrypoint: string;
  entrypointObjectRef?: string;
  title?: string;
  source?: string;
  hasParameters?: boolean;
  files?: string[];
  python?: Record<string, never>; // Presence means "needs Python inspection"
  r?: Record<string, never>; // Presence means "needs R inspection"
  quarto?: { version: string; engines?: string[] };
  alternatives?: PartialConfig[];
}

export interface ContentTypeDetector {
  inferType(baseDir: string, entrypoint?: string): Promise<PartialConfig[]>;
}

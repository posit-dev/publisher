// Copyright (C) 2026 by Posit Software, PBC.

// Mock of the "positron" module for contract tests.
//
// Positron is a fork of VS Code that provides additional APIs for data science
// workflows. The extension optionally depends on these APIs (they are only
// available when running inside Positron, not plain VS Code).
//
// This mock is aliased to the "positron" module via vitest.config.ts so that
// `import { acquirePositronApi } from "positron"` in extension source code
// resolves here instead of requiring the real Positron runtime.

import { vi } from "vitest";

// Mirrors the Positron LanguageRuntimeMetadata interface. The extension reads
// these fields to discover which Python/R interpreters the user has configured
// in Positron (e.g., runtimePath for the interpreter binary, languageId to
// distinguish "python" vs "r", languageVersion for display).
export interface LanguageRuntimeMetadata {
  runtimePath: string;
  runtimeId: string;
  runtimeName: string;
  runtimeShortName: string;
  runtimeVersion: string;
  runtimeSource: string;
  languageName: string;
  languageId: string;
  languageVersion: string;
  base64EncodedIconSvg: string | undefined;
  extraRuntimeData: any;
}

// Shape of the object returned by acquirePositronApi(). The extension only uses
// the `runtime` namespace to query preferred interpreters.
export interface PositronApi {
  version: string;
  runtime: {
    getPreferredRuntime(languageId: string): Promise<LanguageRuntimeMetadata>;
  };
}

// Spy for runtime.getPreferredRuntime(). Tests configure this via
// mockPositronRuntime.getPreferredRuntime.mockResolvedValue(...) to simulate
// Positron returning a specific Python or R runtime.
export const mockPositronRuntime = {
  getPreferredRuntime: vi.fn(),
};

// The mock Positron API object. Returned by acquirePositronApi() below.
export const mockPositronApi: PositronApi = {
  version: "1.0.0",
  runtime: mockPositronRuntime,
};

// The global entry point that extension code calls to obtain the Positron API.
// In real Positron, this is a global function injected by the runtime. Here it
// returns our mockPositronApi so tests can verify the extension calls
// getPreferredRuntime("python") / getPreferredRuntime("r") correctly.
export const acquirePositronApi = vi.fn(() => mockPositronApi);

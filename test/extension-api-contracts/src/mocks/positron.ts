// Copyright (C) 2026 by Posit Software, PBC.

// Mock of the "positron" module for contract tests.

import { vi } from "vitest";

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

export interface PositronApi {
  version: string;
  runtime: {
    getPreferredRuntime(languageId: string): Promise<LanguageRuntimeMetadata>;
  };
}

export const mockPositronRuntime = {
  getPreferredRuntime: vi.fn(),
};

export const mockPositronApi: PositronApi = {
  version: "1.0.0",
  runtime: mockPositronRuntime,
};

// The global function that extension code calls to obtain the Positron API.
export const acquirePositronApi = vi.fn(() => mockPositronApi);

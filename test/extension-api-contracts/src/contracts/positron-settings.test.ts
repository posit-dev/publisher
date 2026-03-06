// Copyright (C) 2026 by Posit Software, PBC.

// Contract: utils/positronSettings.ts → workspace.getConfiguration("positron.r")

import { describe, it, expect, beforeEach, vi } from "vitest";
import { workspace } from "vscode";
import { getPositronRepoSettings } from "src/utils/positronSettings";

describe("positron-settings contract", () => {
  const mockGet = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue(undefined);
    vi.mocked(workspace.getConfiguration).mockReturnValue({
      get: mockGet,
      has: vi.fn(),
      inspect: vi.fn(),
      update: vi.fn(),
    } as any);
  });

  it("reads positron.r configuration section", () => {
    getPositronRepoSettings();
    expect(workspace.getConfiguration).toHaveBeenCalledWith("positron.r");
  });

  it("reads defaultRepositories setting (defaults to 'auto')", () => {
    mockGet.mockReturnValue(undefined);
    const result = getPositronRepoSettings();
    expect(mockGet).toHaveBeenCalledWith("defaultRepositories");
    expect(result.r?.defaultRepositories).toBe("auto");
  });

  it("reads packageManagerRepository setting", () => {
    mockGet.mockImplementation((key: string) => {
      if (key === "defaultRepositories") return "auto";
      if (key === "packageManagerRepository") return "https://ppm.example.com";
      return undefined;
    });
    const result = getPositronRepoSettings();
    expect(mockGet).toHaveBeenCalledWith("packageManagerRepository");
    expect(result.r?.packageManagerRepository).toBe("https://ppm.example.com");
  });

  it("excludes packageManagerRepository when defaultRepositories is not 'auto'", () => {
    mockGet.mockImplementation((key: string) => {
      if (key === "defaultRepositories") return "rstudio";
      if (key === "packageManagerRepository") return "https://ppm.example.com";
      return undefined;
    });
    const result = getPositronRepoSettings();
    expect(result.r?.packageManagerRepository).toBeUndefined();
  });
});

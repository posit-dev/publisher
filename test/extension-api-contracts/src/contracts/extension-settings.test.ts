// Copyright (C) 2026 by Posit Software, PBC.

// Contract: extension.ts extensionSettings → workspace.getConfiguration("positPublisher")

import { describe, it, expect, beforeEach, vi } from "vitest";
import { workspace } from "vscode";

// Mock all transitive dependencies of src/extension.ts
import "../helpers/extension-mocks";

const { extensionSettings } = await import("src/extension");

describe("extension-settings contract", () => {
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

  it("reads verifyCertificates from positPublisher config (default true)", () => {
    mockGet.mockReturnValue(undefined);
    const result = extensionSettings.verifyCertificates();
    expect(workspace.getConfiguration).toHaveBeenCalledWith("positPublisher");
    expect(mockGet).toHaveBeenCalledWith("verifyCertificates");
    expect(result).toBe(true);
  });

  it("returns configured verifyCertificates value when set", () => {
    mockGet.mockReturnValue(false);
    const result = extensionSettings.verifyCertificates();
    expect(result).toBe(false);
  });

  it("reads useKeyChainCredentialStorage from positPublisher config (default true)", () => {
    mockGet.mockReturnValue(undefined);
    const result = extensionSettings.useKeyChainCredentialStorage();
    expect(workspace.getConfiguration).toHaveBeenCalledWith("positPublisher");
    expect(mockGet).toHaveBeenCalledWith("useKeyChainCredentialStorage");
    expect(result).toBe(true);
  });

  it("reads defaultConnectServer from positPublisher config (default '')", async () => {
    mockGet.mockReturnValue(undefined);
    const result = await extensionSettings.defaultConnectServer();
    expect(workspace.getConfiguration).toHaveBeenCalledWith("positPublisher");
    expect(mockGet).toHaveBeenCalledWith("defaultConnectServer");
    expect(result).toBe("");
  });

  it("returns configured defaultConnectServer when set", async () => {
    mockGet.mockReturnValue("https://connect.example.com");
    const result = await extensionSettings.defaultConnectServer();
    expect(result).toBe("https://connect.example.com");
  });

  it("reads autoOpenLogsOnFailure from positPublisher config (default true)", () => {
    mockGet.mockReturnValue(undefined);
    const result = extensionSettings.autoOpenLogsOnFailure();
    expect(workspace.getConfiguration).toHaveBeenCalledWith("positPublisher");
    expect(mockGet).toHaveBeenCalledWith("autoOpenLogsOnFailure");
    expect(result).toBe(true);
  });

  it("reads enableConnectCloud from positPublisher config (default true)", () => {
    mockGet.mockReturnValue(undefined);
    const result = extensionSettings.enableConnectCloud();
    expect(workspace.getConfiguration).toHaveBeenCalledWith("positPublisher");
    expect(mockGet).toHaveBeenCalledWith("enableConnectCloud");
    expect(result).toBe(true);
  });
});

// Copyright (C) 2026 by Posit Software, PBC.

// Contract: llm/index.ts → lm.registerTool

import { describe, it, expect, beforeEach, vi } from "vitest";
import { lm } from "vscode";

// Mock internal dependencies
vi.mock("src/llm/tooling/troubleshoot/publishFailureTroubleshootTool", () => ({
  PublishFailureTroubleshootTool: vi.fn(() => ({ name: "publish-failure" })),
}));

vi.mock("src/llm/tooling/troubleshoot/configurationTroubleshootTool", () => ({
  ConfigurationTroubleshootTool: vi.fn(() => ({ name: "config-error" })),
}));

const { registerLLMTooling } = await import("src/llm/index");

describe("llm-tools contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers troubleshootDeploymentFailure tool", () => {
    const mockContext = {
      subscriptions: [] as any[],
    };
    const mockState = {} as any;

    registerLLMTooling(mockContext as any, mockState);

    expect(lm.registerTool).toHaveBeenCalledWith(
      "publish-content_troubleshootDeploymentFailure",
      expect.any(Object),
    );
  });

  it("registers troubleshootConfigurationError tool", () => {
    const mockContext = {
      subscriptions: [] as any[],
    };
    const mockState = {} as any;

    registerLLMTooling(mockContext as any, mockState);

    expect(lm.registerTool).toHaveBeenCalledWith(
      "publish-content_troubleshootConfigurationError",
      expect.any(Object),
    );
  });
});

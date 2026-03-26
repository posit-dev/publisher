// Copyright (C) 2025 by Posit Software, PBC.

import { describe, test, expect, vi, beforeEach } from "vitest";
import { AxiosInstance } from "axios";
import { ContentRecords } from "./ContentRecords";
import type { PositronSettings } from "../types/positron";

describe("Repo options forwarding to API requests", () => {
  beforeEach(() => vi.clearAllMocks());

  test("ContentRecords.publish forwards positron settings", async () => {
    const mockPost = vi.fn();
    const axiosMock = { post: mockPost } as unknown as AxiosInstance;
    const api = new ContentRecords(axiosMock);

    const targetName = "My Deployment";
    const accountName = "acct";
    const configName = "cfg";
    const insecure = false;
    const dir = "/proj";
    const r = {
      rPath: "/usr/bin/R",
    } as unknown as import("../../types/shared").RExecutable;
    const python = {
      pythonPath: "/usr/bin/python",
    } as unknown as import("../../types/shared").PythonExecutable;
    const secrets = { token: "xyz" };
    const positron: PositronSettings = {
      r: {
        defaultRepositories: "auto",
        packageManagerRepository: "https://example/cran",
      },
    };

    mockPost.mockResolvedValue({ status: 200, data: { localId: "1" } });
    await api.publish(
      targetName,
      accountName,
      configName,
      insecure,
      dir,
      r,
      python,
      secrets,
      positron,
    );

    expect(mockPost).toHaveBeenCalledWith(
      "deployments/My%20Deployment",
      { account: accountName, config: configName, secrets, insecure, positron },
      { params: { dir, r: "/usr/bin/R", python: "/usr/bin/python" } },
    );
  });
});

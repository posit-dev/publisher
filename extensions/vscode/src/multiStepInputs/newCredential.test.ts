// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { ServerType } from "src/api/types/contentRecords";

const {
  newConnectCredentialMock,
  newConnectCloudCredentialMock,
  getPlatformListMock,
} = vi.hoisted(() => ({
  newConnectCredentialMock: vi.fn(() =>
    Promise.resolve({
      guid: "g",
      name: "n",
      url: "https://connect.example.com",
      serverType: ServerType.CONNECT,
    }),
  ),
  newConnectCloudCredentialMock: vi.fn(() =>
    Promise.resolve({
      guid: "g",
      name: "n",
      url: "",
      serverType: ServerType.CONNECT_CLOUD,
    }),
  ),
  getPlatformListMock: vi.fn(() => [
    { label: "Posit Connect" },
    { label: "Posit Connect Cloud" },
  ]),
}));

vi.mock("./newConnectCredential", () => ({
  newConnectCredential: newConnectCredentialMock,
}));
vi.mock("./newConnectCloudCredential", () => ({
  newConnectCloudCredential: newConnectCloudCredentialMock,
}));

// Both platforms available so resolvedServerType can only come from the
// caller-supplied startingServerType, not the "only one platform" fallback.
vi.mock("./common", () => ({
  getPlatformList: getPlatformListMock,
}));

vi.mock("./multiStepHelper", () => ({
  AbortError: class AbortError extends Error {},
  MultiStepInput: {
    run: vi.fn(async (start: { step: (input: unknown) => unknown }) => {
      let currentStep:
        { step: (input: unknown) => unknown } | void | undefined = start;
      while (currentStep) {
        currentStep = (await currentStep.step({})) as {
          step: (input: unknown) => unknown;
        } | void;
      }
    }),
  },
}));

import { newCredential, UnavailablePlatformError } from "./newCredential";

beforeEach(() => vi.clearAllMocks());

describe("newCredential startingServerUrl passthrough", () => {
  test("forwards startingServerUrl to newConnectCredential when the target is already known", async () => {
    await newCredential(
      "test-view-id",
      "Create a New Credential",
      {} as unknown as import("src/credentials/service").CredentialsService,
      "https://connect.example.com",
      undefined,
      ServerType.CONNECT,
      "browser",
    );

    expect(newConnectCredentialMock).toHaveBeenCalledWith(
      "test-view-id",
      "Create a New Credential",
      {},
      "https://connect.example.com",
      expect.anything(),
      "browser",
      false,
    );
  });

  test("forwards trustServerUrl to newConnectCredential only when explicitly set", async () => {
    await newCredential(
      "test-view-id",
      "Create a New Credential",
      {} as unknown as import("src/credentials/service").CredentialsService,
      "https://connect.example.com",
      undefined,
      ServerType.CONNECT,
      "browser",
      true,
    );

    expect(newConnectCredentialMock).toHaveBeenCalledWith(
      "test-view-id",
      "Create a New Credential",
      {},
      "https://connect.example.com",
      expect.anything(),
      "browser",
      true,
    );
  });
});

describe("newCredential startingServerType availability", () => {
  test("rejects a startingServerType that getPlatformList() doesn't offer", async () => {
    getPlatformListMock.mockReturnValueOnce([{ label: "Posit Connect" }]);

    await expect(
      newCredential(
        "test-view-id",
        "Create a New Credential",
        {} as unknown as import("src/credentials/service").CredentialsService,
        undefined,
        undefined,
        ServerType.CONNECT_CLOUD,
      ),
    ).rejects.toThrow(UnavailablePlatformError);

    expect(newConnectCloudCredentialMock).not.toHaveBeenCalled();
  });
});

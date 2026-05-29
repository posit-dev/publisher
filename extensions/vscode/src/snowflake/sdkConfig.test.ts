// Copyright (C) 2026 by Posit Software, PBC.

import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockSecretStorage } from "src/test/unit-test-utils/vscode-mocks";
import { SnowflakeSecretStorageCredentialManager } from "./secretStorageCredentialManager";

vi.mock("snowflake-sdk");

import snowflake from "snowflake-sdk";

import { configureSnowflakeSDK } from "./sdkConfig";

describe("configureSnowflakeSDK", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("configures snowflake-sdk exactly once with a credential manager", () => {
    configureSnowflakeSDK(new mockSecretStorage());

    expect(snowflake.configure).toHaveBeenCalledTimes(1);
    const options = vi.mocked(snowflake.configure).mock.calls[0]?.[0];
    expect(options).toEqual(
      expect.objectContaining({
        customCredentialManager: expect.any(
          SnowflakeSecretStorageCredentialManager,
        ),
      }),
    );
  });

  it("installs a credential manager wired to the provided SecretStorage", async () => {
    const secrets = new mockSecretStorage();
    configureSnowflakeSDK(secrets);

    // configure()'s type declares customCredentialManager as `object`; narrow to
    // the concrete manager we install so we can exercise its hooks.
    const options = vi.mocked(snowflake.configure).mock.calls[0]?.[0];
    const manager =
      options?.customCredentialManager as SnowflakeSecretStorageCredentialManager;

    // The SDK validates that read/write/remove are *own* properties (not
    // inherited from the prototype) — pin that contract.
    expect(Object.hasOwn(manager, "read")).toBe(true);
    expect(Object.hasOwn(manager, "write")).toBe(true);
    expect(Object.hasOwn(manager, "remove")).toBe(true);

    // The hooks round-trip through the provided SecretStorage under the
    // snowflake-token: prefix.
    await manager.write("acct:user:token", "secret-value");
    expect(await secrets.get("snowflake-token:acct:user:token")).toBe(
      "secret-value",
    );
    expect(await manager.read("acct:user:token")).toBe("secret-value");

    await manager.remove("acct:user:token");
    expect(await manager.read("acct:user:token")).toBeNull();
  });
});

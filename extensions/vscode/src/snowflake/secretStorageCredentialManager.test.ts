// Copyright (C) 2026 by Posit Software, PBC.

import { beforeEach, describe, expect, test } from "vitest";
import { mockSecretStorage } from "src/test/unit-test-utils/vscode-mocks";
import { SnowflakeSecretStorageCredentialManager } from "./secretStorageCredentialManager";

describe("SnowflakeSecretStorageCredentialManager", () => {
  let secrets: mockSecretStorage;
  let manager: SnowflakeSecretStorageCredentialManager;

  beforeEach(() => {
    secrets = new mockSecretStorage();
    manager = new SnowflakeSecretStorageCredentialManager(secrets);
  });

  test("write stores token with snowflake-token prefix", async () => {
    const key = "account:user";
    const token = "session_token_xyz";

    const result = await manager.write(key, token);

    expect(result).toBeNull();
    expect(secrets.store).toHaveBeenCalledWith(
      "snowflake-token:account:user",
      token,
    );
  });

  test("read retrieves stored token with prefix", async () => {
    const key = "account:user";
    const token = "session_token_xyz";

    await manager.write(key, token);
    const result = await manager.read(key);

    expect(result).toBe(token);
    expect(secrets.get).toHaveBeenCalledWith("snowflake-token:account:user");
  });

  test("read returns null when token not found", async () => {
    const result = await manager.read("nonexistent:key");

    expect(result).toBeNull();
  });

  test("remove deletes token from storage", async () => {
    const key = "account:user";
    const token = "session_token_xyz";

    await manager.write(key, token);
    const result = await manager.remove(key);

    expect(result).toBeNull();
    expect(secrets.delete).toHaveBeenCalledWith("snowflake-token:account:user");
  });

  test("multiple tokens can be stored with different keys", async () => {
    const key1 = "account1:user1";
    const key2 = "account2:user2";
    const token1 = "token1";
    const token2 = "token2";

    await manager.write(key1, token1);
    await manager.write(key2, token2);

    const result1 = await manager.read(key1);
    const result2 = await manager.read(key2);

    expect(result1).toBe(token1);
    expect(result2).toBe(token2);
  });

  test("methods are own properties (required by Snowflake SDK validation)", () => {
    // Snowflake SDK's checkValidCustomCredentialManager uses
    // Object.hasOwnProperty.call() to validate methods, so they must be
    // own properties of the instance, not inherited from the prototype
    expect(Object.prototype.hasOwnProperty.call(manager, "write")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(manager, "read")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(manager, "remove")).toBe(true);

    expect(typeof manager.write).toBe("function");
    expect(typeof manager.read).toBe("function");
    expect(typeof manager.remove).toBe("function");
  });
});

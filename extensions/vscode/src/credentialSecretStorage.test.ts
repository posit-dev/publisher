// Copyright (C) 2026 by Posit Software, PBC.

import { beforeEach, describe, expect, test, vi } from "vitest";

import { credentialFactory } from "src/test/unit-test-utils/factories";
import { mockSecretStorage } from "src/test/unit-test-utils/vscode-mocks";
import {
  syncAllCredentials,
  getAllCredentials,
  parseCredentialRecord,
} from "./credentialSecretStorage";

vi.mock("vscode", () => {
  return {
    window: {
      createOutputChannel: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      })),
    },
  };
});

describe("credentialSecretStorage", () => {
  let secrets: mockSecretStorage;

  beforeEach(() => {
    secrets = new mockSecretStorage();
  });

  describe("parseCredentialRecord", () => {
    test("parses a valid credential record", () => {
      const cred = credentialFactory.build();
      const json = JSON.stringify({ version: 1, credential: cred });
      const result = parseCredentialRecord(json);
      expect(result).toEqual(cred);
    });

    test("rejects record with wrong version", () => {
      const cred = credentialFactory.build();
      const json = JSON.stringify({ version: 2, credential: cred });
      const result = parseCredentialRecord(json);
      expect(result).toBeUndefined();
    });

    test("rejects record with missing credential object", () => {
      const json = JSON.stringify({ version: 1 });
      const result = parseCredentialRecord(json);
      expect(result).toBeUndefined();
    });

    test("rejects record with missing required field", () => {
      const cred = credentialFactory.build();
      const { guid: _, ...incomplete } = cred;
      const json = JSON.stringify({ version: 1, credential: incomplete });
      const result = parseCredentialRecord(json);
      expect(result).toBeUndefined();
    });

    test("rejects record with non-string field value", () => {
      const cred = credentialFactory.build();
      const modified = { ...cred, apiKey: 12345 };
      const json = JSON.stringify({ version: 1, credential: modified });
      const result = parseCredentialRecord(json);
      expect(result).toBeUndefined();
    });

    test("rejects invalid JSON", () => {
      const result = parseCredentialRecord("not json");
      expect(result).toBeUndefined();
    });
  });

  describe("syncAllCredentials", () => {
    test("stores all credentials with versioned envelope", async () => {
      const creds = credentialFactory.buildList(2);
      await syncAllCredentials(secrets, creds);

      expect(secrets.store).toHaveBeenCalledTimes(2);
      for (const cred of creds) {
        expect(secrets.store).toHaveBeenCalledWith(
          `credential:${cred.guid}`,
          JSON.stringify({ version: 1, credential: cred }),
        );
      }
    });

    test("removes stale credentials", async () => {
      // Pre-populate with a credential that won't be in the new list
      await secrets.store(
        "credential:old-guid",
        JSON.stringify({
          version: 1,
          credential: credentialFactory.build({ guid: "old-guid" }),
        }),
      );
      secrets.store.mockClear();

      const creds = credentialFactory.buildList(1);
      await syncAllCredentials(secrets, creds);

      expect(secrets.delete).toHaveBeenCalledWith("credential:old-guid");
    });

    test("does not remove non-credential keys", async () => {
      await secrets.store("other-key", "some-value");
      secrets.store.mockClear();

      await syncAllCredentials(secrets, []);

      expect(secrets.delete).not.toHaveBeenCalledWith("other-key");
    });

    test("is idempotent - running twice produces same result", async () => {
      const creds = credentialFactory.buildList(2);
      await syncAllCredentials(secrets, creds);
      await syncAllCredentials(secrets, creds);

      // Both credentials should still be stored
      const allKeys = await secrets.keys();
      const credKeys = allKeys.filter((k: string) =>
        k.startsWith("credential:"),
      );
      expect(credKeys).toHaveLength(2);
    });

    test("handles empty credential list", async () => {
      await syncAllCredentials(secrets, []);

      expect(secrets.store).not.toHaveBeenCalled();
    });

    test("does not throw when SecretStorage errors", async () => {
      secrets.store.mockRejectedValueOnce(new Error("storage failure"));

      // Should not throw
      await syncAllCredentials(secrets, credentialFactory.buildList(1));
    });
  });

  describe("getAllCredentials", () => {
    test("returns all valid credentials", async () => {
      const creds = credentialFactory.buildList(2);
      await syncAllCredentials(secrets, creds);

      const result = await getAllCredentials(secrets);
      expect(result).toEqual(creds);
    });

    test("skips malformed entries", async () => {
      const validCred = credentialFactory.build();
      await secrets.store(
        `credential:${validCred.guid}`,
        JSON.stringify({ version: 1, credential: validCred }),
      );
      // Store a malformed entry
      await secrets.store("credential:bad-guid", "not valid json");

      const result = await getAllCredentials(secrets);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(validCred);
    });

    test("returns empty array when no credentials exist", async () => {
      const result = await getAllCredentials(secrets);
      expect(result).toEqual([]);
    });

    test("ignores non-credential keys", async () => {
      await secrets.store("other-key", "some-value");

      const result = await getAllCredentials(secrets);
      expect(result).toEqual([]);
    });

    test("does not throw when SecretStorage errors", async () => {
      secrets.keys.mockRejectedValueOnce(new Error("storage failure"));

      const result = await getAllCredentials(secrets);
      expect(result).toEqual([]);
    });
  });
});

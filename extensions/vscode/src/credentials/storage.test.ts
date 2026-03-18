// Copyright (C) 2026 by Posit Software, PBC.

import { beforeEach, describe, expect, test, vi } from "vitest";

import { credentialFactory } from "src/test/unit-test-utils/factories";
import { mockSecretStorage } from "src/test/unit-test-utils/vscode-mocks";
import {
  storeCredential,
  getCredential,
  deleteCredential,
  deleteAllCredentials,
  getAllCredentials,
  parseCredentialRecord,
} from "./storage";

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

  describe("storeCredential", () => {
    test("stores a credential with versioned envelope", async () => {
      const cred = credentialFactory.build();
      await storeCredential(secrets, cred);

      expect(secrets.store).toHaveBeenCalledWith(
        `credential:${cred.guid}`,
        JSON.stringify({ version: 1, credential: cred }),
      );
    });

    test("overwrites an existing credential with the same GUID", async () => {
      const cred = credentialFactory.build();
      await storeCredential(secrets, cred);

      const updated = { ...cred, name: "Updated Name" };
      await storeCredential(secrets, updated);

      const result = await getCredential(secrets, cred.guid);
      expect(result?.name).toBe("Updated Name");
    });
  });

  describe("getCredential", () => {
    test("returns a stored credential by GUID", async () => {
      const cred = credentialFactory.build();
      await storeCredential(secrets, cred);

      const result = await getCredential(secrets, cred.guid);
      expect(result).toEqual(cred);
    });

    test("returns undefined for non-existent GUID", async () => {
      const result = await getCredential(secrets, "nonexistent");
      expect(result).toBeUndefined();
    });

    test("returns undefined for malformed record", async () => {
      await secrets.store("credential:bad-guid", "not valid json");

      const result = await getCredential(secrets, "bad-guid");
      expect(result).toBeUndefined();
    });
  });

  describe("deleteCredential", () => {
    test("deletes a credential by GUID", async () => {
      const cred = credentialFactory.build();
      await storeCredential(secrets, cred);

      await deleteCredential(secrets, cred.guid);

      const result = await getCredential(secrets, cred.guid);
      expect(result).toBeUndefined();
    });

    test("does not throw when deleting non-existent GUID", async () => {
      await deleteCredential(secrets, "nonexistent");
      expect(secrets.delete).toHaveBeenCalledWith("credential:nonexistent");
    });
  });

  describe("deleteAllCredentials", () => {
    test("deletes all credential keys", async () => {
      const creds = credentialFactory.buildList(3);
      for (const cred of creds) {
        await storeCredential(secrets, cred);
      }

      await deleteAllCredentials(secrets);

      const result = await getAllCredentials(secrets);
      expect(result).toEqual([]);
    });

    test("does not delete non-credential keys", async () => {
      await secrets.store("other-key", "some-value");
      const cred = credentialFactory.build();
      await storeCredential(secrets, cred);

      await deleteAllCredentials(secrets);

      expect(secrets.delete).not.toHaveBeenCalledWith("other-key");
      const json = await secrets.get("other-key");
      expect(json).toBe("some-value");
    });

    test("handles empty storage", async () => {
      await deleteAllCredentials(secrets);
      expect(secrets.delete).not.toHaveBeenCalled();
    });
  });

  describe("getAllCredentials", () => {
    test("returns all valid credentials", async () => {
      const creds = credentialFactory.buildList(2);
      for (const cred of creds) {
        await storeCredential(secrets, cred);
      }

      const result = await getAllCredentials(secrets);
      expect(result).toEqual(creds);
    });

    test("skips malformed entries", async () => {
      const validCred = credentialFactory.build();
      await storeCredential(secrets, validCred);
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

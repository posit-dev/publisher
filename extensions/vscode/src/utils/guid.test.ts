// Copyright (C) 2025 by Posit Software, PBC.

import { describe, expect, test } from "vitest";
import { extractGUID, GUID_REGEX } from "./guid";

describe("GUID_REGEX", () => {
  test("matches a standard GUID format", () => {
    const guid = "adffa505-08c7-450f-88d0-f42957f56eff";
    expect(GUID_REGEX.test(guid)).toBe(true);
  });

  test("matches a GUID with braces", () => {
    const guid = "{adffa505-08c7-450f-88d0-f42957f56eff}";
    expect(GUID_REGEX.test(guid)).toBe(true);
  });

  test("does not match invalid GUID formats", () => {
    expect(GUID_REGEX.test("")).toBe(false);
    expect(GUID_REGEX.test("hello world")).toBe(false);
    expect(GUID_REGEX.test("adffa505-08c7-450f-88d0-f42957f56ef")).toBe(false); // too short
    expect(GUID_REGEX.test("adffa505-08c7-450f-88d0-f42957f56ezz")).toBe(false); // invalid chars
  });
});

describe("extractGUID", () => {
  describe("valid GUID inputs", () => {
    test("extracts GUID from Connect in-app URL", () => {
      const input =
        "https://connect.company.co/connect/#/apps/adffa505-08c7-450f-88d0-f42957f56eff";
      const result = extractGUID(input);
      expect(result).not.toBeNull();
      expect(result?.[0]).toBe("adffa505-08c7-450f-88d0-f42957f56eff");
    });

    test("extracts GUID from Connect standalone URL", () => {
      const input =
        "https://connect.company.co/content/adffa505-08c7-450f-88d0-f42957f56eff";
      const result = extractGUID(input);
      expect(result).not.toBeNull();
      expect(result?.[0]).toBe("adffa505-08c7-450f-88d0-f42957f56eff");
    });

    test("extracts GUID from Connect standalone URL with trailing slash", () => {
      const input =
        "https://connect.company.co/content/adffa505-08c7-450f-88d0-f42957f56eff/";
      const result = extractGUID(input);
      expect(result).not.toBeNull();
      expect(result?.[0]).toBe("adffa505-08c7-450f-88d0-f42957f56eff");
    });

    test("extracts GUID from Connect Cloud URL", () => {
      const input =
        "https://connect.posit.cloud/my-account/content/adffa505-08c7-450f-88d0-f42957f56eff";
      const result = extractGUID(input);
      expect(result).not.toBeNull();
      expect(result?.[0]).toBe("adffa505-08c7-450f-88d0-f42957f56eff");
    });

    test("extracts GUID from text with GUID embedded", () => {
      const input =
        "The GUID is adffa505-08c7-450f-88d0-f42957f56eff in the system";
      const result = extractGUID(input);
      expect(result).not.toBeNull();
      expect(result?.[0]).toBe("adffa505-08c7-450f-88d0-f42957f56eff");
    });

    test("extracts GUID from Connect URL with deep path", () => {
      const input =
        "https://company.co/data-science/2025/staging/#/apps/adffa505-08c7-450f-88d0-f42957f56eff";
      const result = extractGUID(input);
      expect(result).not.toBeNull();
      expect(result?.[0]).toBe("adffa505-08c7-450f-88d0-f42957f56eff");
    });
  });

  describe("invalid inputs", () => {
    test("returns null for empty string", () => {
      const result = extractGUID("");
      expect(result).toBeNull();
    });

    test("returns null for random text without GUID", () => {
      const result = extractGUID("hello world");
      expect(result).toBeNull();
    });

    test("returns null for almost-GUID (too short)", () => {
      const result = extractGUID("adffa505-08c7-450f-88d0-f42957f56ef");
      expect(result).toBeNull();
    });

    test("returns null for almost-GUID (non-hex characters)", () => {
      const result = extractGUID("adffa505-08c7-450f-88d0-f42957f56ezz");
      expect(result).toBeNull();
    });

    test("returns null for URL without GUID", () => {
      const result = extractGUID("https://connect.company.co/connect/#/apps/");
      expect(result).toBeNull();
    });

    test("returns null for incomplete GUID", () => {
      const result = extractGUID("adffa505-08c7-450f-88d0");
      expect(result).toBeNull();
    });
  });
});

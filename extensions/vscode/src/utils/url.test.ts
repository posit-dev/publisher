// Copyright (C) 2025 by Posit Software, PBC.

import { describe, expect, test } from "vitest";
import {
  formatURL,
  normalizeURL,
  isConnectCloudContentURL,
  extractConnectCloudAccount,
} from "./url";

describe("formatURL", () => {
  test("returns URL unchanged if it has a scheme", () => {
    expect(formatURL("https://example.com")).toBe("https://example.com");
    expect(formatURL("http://example.com")).toBe("http://example.com");
  });

  test("adds https:// if no scheme is present", () => {
    expect(formatURL("example.com")).toBe("https://example.com");
    expect(formatURL("connect.company.co")).toBe("https://connect.company.co");
  });
});

describe("normalizeURL", () => {
  test("adds trailing slash if not present", () => {
    expect(normalizeURL("https://example.com")).toBe("https://example.com/");
  });

  test("does not add trailing slash if already present", () => {
    expect(normalizeURL("https://example.com/")).toBe("https://example.com/");
  });
});

describe("isConnectCloudContentURL", () => {
  describe("valid Connect Cloud URLs", () => {
    test("returns true for standard Connect Cloud URL", () => {
      const url =
        "https://connect.posit.cloud/my-account/content/adffa505-08c7-450f-88d0-f42957f56eff";
      expect(isConnectCloudContentURL(url)).toBe(true);
    });

    test("returns true for Connect Cloud URL with different account", () => {
      const url =
        "https://connect.posit.cloud/user-profile-123/content/adffa505-08c7-450f-88d0-f42957f56eff";
      expect(isConnectCloudContentURL(url)).toBe(true);
    });

    test("returns true for Connect Cloud URL with slug", () => {
      const url =
        "https://connect.posit.cloud/slug123/content/adffa505-08c7-450f-88d0-f42957f56eff";
      expect(isConnectCloudContentURL(url)).toBe(true);
    });
  });

  describe("invalid Connect Cloud URLs", () => {
    test("returns false for URL with underscores in account", () => {
      const url =
        "https://connect.posit.cloud/slug_with_underscore/content/adffa505-08c7-450f-88d0-f42957f56eff";
      expect(isConnectCloudContentURL(url)).toBe(false);
    });

    test("returns false for URL with space in account", () => {
      const url =
        "https://connect.posit.cloud/my account/content/adffa505-08c7-450f-88d0-f42957f56eff";
      expect(isConnectCloudContentURL(url)).toBe(false);
    });

    test("returns false for URL with extra path segment", () => {
      const url =
        "https://connect.posit.cloud/my-account/folder/content/adffa505-08c7-450f-88d0-f42957f56eff";
      expect(isConnectCloudContentURL(url)).toBe(false);
    });

    test("returns false for URL without GUID", () => {
      const url = "https://connect.posit.cloud/my-account/content/";
      expect(isConnectCloudContentURL(url)).toBe(false);
    });
  });
});

describe("extractConnectCloudAccount", () => {
  test("extracts account from standard Connect Cloud URL", () => {
    const url =
      "https://connect.posit.cloud/my-account/content/adffa505-08c7-450f-88d0-f42957f56eff";
    expect(extractConnectCloudAccount(url)).toBe("my-account");
  });

  test("extracts account from URL with different account name", () => {
    const url =
      "https://connect.posit.cloud/user-profile-123/content/adffa505-08c7-450f-88d0-f42957f56eff";
    expect(extractConnectCloudAccount(url)).toBe("user-profile-123");
  });

  test("extracts account from URL with slug", () => {
    const url =
      "https://connect.posit.cloud/slug123/content/adffa505-08c7-450f-88d0-f42957f56eff";
    expect(extractConnectCloudAccount(url)).toBe("slug123");
  });
});

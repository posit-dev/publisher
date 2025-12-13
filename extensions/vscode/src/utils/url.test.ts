// Copyright (C) 2025 by Posit Software, PBC.

import { describe, expect, test } from "vitest";
import {
  formatURL,
  normalizeURL,
  isConnectContentURL,
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

describe("isConnectContentURL", () => {
  describe("valid Connect in-app URLs", () => {
    test("returns true for standard Connect in-app URL", () => {
      const url =
        "https://connect.company.co/connect/#/apps/adffa505-08c7-450f-88d0-f42957f56eff";
      expect(isConnectContentURL(url)).toBe(true);
    });

    test("returns true for Connect URL with subdomain", () => {
      const url =
        "https://connect.my_sub.company.com/connect/#/apps/adffa505-08c7-450f-88d0-f42957f56eff";
      expect(isConnectContentURL(url)).toBe(true);
    });

    test("returns true for Connect URL with deep subdomain", () => {
      const url =
        "https://connect.another.deep_sub.domain_name.org/connect/#/apps/adffa505-08c7-450f-88d0-f42957f56eff";
      expect(isConnectContentURL(url)).toBe(true);
    });

    test("returns true for Connect URL with deep path", () => {
      const url =
        "https://company.co/data-science/2025/staging-server/#/apps/adffa505-08c7-450f-88d0-f42957f56eff";
      expect(isConnectContentURL(url)).toBe(true);
    });

    test("returns true for http Connect URL", () => {
      const url =
        "http://connect.company.co/connect/#/apps/adffa505-08c7-450f-88d0-f42957f56eff";
      expect(isConnectContentURL(url)).toBe(true);
    });
  });

  describe("invalid Connect URLs", () => {
    test("returns false for wrong path structure", () => {
      const url =
        "https://connect.company.co/wrong/connect/#/path/apps/adffa505-08c7-450f-88d0-f42957f56eff";
      expect(isConnectContentURL(url)).toBe(false);
    });

    test("returns false for missing slash before #", () => {
      const url =
        "https://connect.company.co/connect/#apps/adffa505-08c7-450f-88d0-f42957f56eff";
      expect(isConnectContentURL(url)).toBe(false);
    });

    test("returns false for invalid path after #", () => {
      const url =
        "https://connect.invalid.com/connect/#/@pps/adffa505-08c7-450f-88d0-f42957f56eff";
      expect(isConnectContentURL(url)).toBe(false);
    });

    test("returns false for URL without GUID", () => {
      const url = "https://connect.company.co/connect/#/apps/";
      expect(isConnectContentURL(url)).toBe(false);
    });
  });

  describe("Connect standalone URLs", () => {
    test("returns false for Connect standalone URL (current behavior)", () => {
      // This documents the current behavior - standalone URLs are NOT accepted
      // This is the bug we're fixing - ideally this should be true
      const url =
        "https://connect.company.co/content/adffa505-08c7-450f-88d0-f42957f56eff";
      expect(isConnectContentURL(url)).toBe(false);
    });

    test("returns false for Connect standalone URL with trailing slash", () => {
      const url =
        "https://connect.company.co/content/adffa505-08c7-450f-88d0-f42957f56eff/";
      expect(isConnectContentURL(url)).toBe(false);
    });
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

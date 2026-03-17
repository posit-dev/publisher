// Copyright (C) 2025 by Posit Software, PBC.

import { describe, expect, test } from "vitest";
import {
  formatURL,
  normalizeURL,
  normalizeServerURL,
  getListOfPossibleUrls,
  discoverServerUrl,
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

describe("normalizeServerURL", () => {
  test("preserves http URL unchanged", () => {
    expect(normalizeServerURL("http://connect.example.com")).toBe(
      "http://connect.example.com",
    );
  });

  test("preserves https URL unchanged", () => {
    expect(normalizeServerURL("https://connect.example.com")).toBe(
      "https://connect.example.com",
    );
  });

  test("preserves path", () => {
    expect(normalizeServerURL("https://connect.example.com/rsc")).toBe(
      "https://connect.example.com/rsc",
    );
  });

  test("lowercases hostname", () => {
    expect(normalizeServerURL("https://CONNECT.example.com")).toBe(
      "https://connect.example.com",
    );
  });

  test("removes default port for https", () => {
    expect(normalizeServerURL("https://connect.example.com:443/rsc")).toBe(
      "https://connect.example.com/rsc",
    );
  });

  test("removes duplicate slashes and trailing slash", () => {
    expect(normalizeServerURL("https://connect.example.com///rsc/")).toBe(
      "https://connect.example.com/rsc",
    );
  });

  test("throws on invalid URL", () => {
    expect(() => normalizeServerURL("not a url")).toThrow();
  });
});

describe("getListOfPossibleUrls", () => {
  test("throws on invalid URL", () => {
    expect(() => getListOfPossibleUrls("not a url")).toThrow();
  });

  test("returns single URL when no path", () => {
    const result = getListOfPossibleUrls("https://connect.dev.com");
    expect(result).toEqual(["https://connect.dev.com"]);
  });

  test("strips query parameters", () => {
    const result = getListOfPossibleUrls("https://connect.dev.com?a=b");
    expect(result).toEqual(["https://connect.dev.com"]);
  });

  test("returns progressive list of path segments", () => {
    const result = getListOfPossibleUrls("https://connect.dev.com/a/b/c/d/e");
    expect(result).toEqual([
      "https://connect.dev.com",
      "https://connect.dev.com/a",
      "https://connect.dev.com/a/b",
      "https://connect.dev.com/a/b/c",
      "https://connect.dev.com/a/b/c/d",
      "https://connect.dev.com/a/b/c/d/e",
    ]);
  });

  test("handles duplicate slashes same as clean URL", () => {
    const result = getListOfPossibleUrls(
      "https://connect.dev.com//a/b/c/d/e//////",
    );
    expect(result).toEqual([
      "https://connect.dev.com",
      "https://connect.dev.com/a",
      "https://connect.dev.com/a/b",
      "https://connect.dev.com/a/b/c",
      "https://connect.dev.com/a/b/c/d",
      "https://connect.dev.com/a/b/c/d/e",
    ]);
  });
});

describe("discoverServerUrl", () => {
  test("returns first working URL from middle segment", async () => {
    const tester = (url: string): Promise<void> => {
      if (url === "https://connect.dev.com/server") return Promise.resolve();
      return Promise.reject(new Error("not found"));
    };

    const result = await discoverServerUrl(
      "https://connect.dev.com/server/connect/#/apps",
      tester,
    );
    expect(result).toBe("https://connect.dev.com/server");
  });

  test("throws last error when all testers fail", async () => {
    const tester = (): Promise<void> =>
      Promise.reject(new Error("always fails"));

    await expect(
      discoverServerUrl("https://connect.dev.com/path", tester),
    ).rejects.toThrow("always fails");
  });

  test("returns base URL when only base works", async () => {
    const tester = (url: string): Promise<void> => {
      if (url === "https://connect.dev.com") return Promise.resolve();
      return Promise.reject(new Error("not base"));
    };

    const result = await discoverServerUrl(
      "https://connect.dev.com/connect/#/welcome",
      tester,
    );
    expect(result).toBe("https://connect.dev.com");
  });

  test("tests URLs in reverse order (full path first)", async () => {
    const callOrder: string[] = [];
    const tester = (url: string): Promise<void> => {
      callOrder.push(url);
      if (url === "https://connect.dev.com/a") return Promise.resolve();
      return Promise.reject(new Error("not found"));
    };

    const result = await discoverServerUrl(
      "https://connect.dev.com/a/b/c",
      tester,
    );
    expect(result).toBe("https://connect.dev.com/a");
    expect(callOrder).toEqual([
      "https://connect.dev.com/a/b/c",
      "https://connect.dev.com/a/b",
      "https://connect.dev.com/a",
    ]);
  });

  test("throws on invalid URL", async () => {
    const tester = (): Promise<void> => Promise.resolve();
    await expect(discoverServerUrl("not a url", tester)).rejects.toThrow();
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

// Copyright (C) 2025 by Posit Software, PBC.

import { describe, expect, test, vi } from "vitest";
import {
  formatURL,
  normalizeURL,
  isConnectCloudContentURL,
  extractConnectCloudAccount,
  serverTypeFromURL,
  getListOfPossibleURLs,
  discoverServerURL,
} from "./url";
import { ServerType } from "src/api/types/contentRecords";

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

// ---------------------------------------------------------------------------
// serverTypeFromURL — port of Go server_type.ServerTypeFromURL
// ---------------------------------------------------------------------------

describe("serverTypeFromURL", () => {
  test("returns CONNECT_CLOUD for connect.posit.cloud", () => {
    expect(serverTypeFromURL("https://connect.posit.cloud")).toBe(
      ServerType.CONNECT_CLOUD,
    );
  });

  test("returns CONNECT_CLOUD for staging.connect.posit.cloud", () => {
    expect(serverTypeFromURL("https://staging.connect.posit.cloud")).toBe(
      ServerType.CONNECT_CLOUD,
    );
  });

  test("returns CONNECT for generic URLs", () => {
    expect(serverTypeFromURL("https://example.com")).toBe(ServerType.CONNECT);
    expect(serverTypeFromURL("https://example.com/connect/#/content")).toBe(
      ServerType.CONNECT,
    );
  });

  test("returns SNOWFLAKE for .snowflakecomputing.app", () => {
    expect(serverTypeFromURL("https://example.snowflakecomputing.app")).toBe(
      ServerType.SNOWFLAKE,
    );
    expect(
      serverTypeFromURL(
        "https://example.snowflakecomputing.app/connect/#/content",
      ),
    ).toBe(ServerType.SNOWFLAKE);
  });

  test("returns SNOWFLAKE for .privatelink.snowflake.app", () => {
    expect(serverTypeFromURL("https://example.privatelink.snowflake.app")).toBe(
      ServerType.SNOWFLAKE,
    );
    expect(
      serverTypeFromURL(
        "https://example.privatelink.snowflake.app/connect/#/content",
      ),
    ).toBe(ServerType.SNOWFLAKE);
  });

  test("throws on invalid URL", () => {
    expect(() => serverTypeFromURL(":bad")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// getListOfPossibleURLs — port of Go util.GetListOfPossibleURLs
// ---------------------------------------------------------------------------

describe("getListOfPossibleURLs", () => {
  test("returns single URL when no path", () => {
    const result = getListOfPossibleURLs("https://connect.dev.com");
    expect(result).toEqual(["https://connect.dev.com"]);
  });

  test("strips query from URL", () => {
    const result = getListOfPossibleURLs("https://connect.dev.com?a=b");
    expect(result).toEqual(["https://connect.dev.com"]);
  });

  test("returns list of progressively longer paths", () => {
    const result = getListOfPossibleURLs("https://connect.dev.com/a/b/c/d/e");
    expect(result).toEqual([
      "https://connect.dev.com",
      "https://connect.dev.com/a",
      "https://connect.dev.com/a/b",
      "https://connect.dev.com/a/b/c",
      "https://connect.dev.com/a/b/c/d",
      "https://connect.dev.com/a/b/c/d/e",
    ]);
  });

  test("handles duplicate forward slashes", () => {
    const result = getListOfPossibleURLs(
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

  test("throws on invalid URL", () => {
    expect(() => getListOfPossibleURLs("not a url")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// discoverServerURL — port of Go util.DiscoverServerURL
// ---------------------------------------------------------------------------

describe("discoverServerURL", () => {
  test("returns first working URL (successful discovery)", async () => {
    const tester = vi.fn((url: string) => {
      if (url !== "https://connect.dev.com/server") {
        return Promise.reject(new Error("not found"));
      }
      return Promise.resolve();
    });

    const result = await discoverServerURL(
      "https://connect.dev.com/server/connect/#/apps",
      tester,
    );
    expect(result.url).toBe("https://connect.dev.com/server");
    expect(result.error).toBeUndefined();
  });

  test("returns original URL and error when all fail", async () => {
    const tester = vi.fn(() => {
      return Promise.reject(new Error("always fails"));
    });

    const result = await discoverServerURL(
      "https://connect.dev.com/path",
      tester,
    );
    expect(result.url).toBe("https://connect.dev.com/path");
    expect(result.error).toBeDefined();
    expect((result.error as Error).message).toBe("always fails");
  });

  test("finds base URL when only base works", async () => {
    const tester = vi.fn((url: string) => {
      if (url !== "https://connect.dev.com") {
        return Promise.reject(new Error("not base"));
      }
      return Promise.resolve();
    });

    const result = await discoverServerURL(
      "https://connect.dev.com/connect/#/welcome",
      tester,
    );
    expect(result.url).toBe("https://connect.dev.com");
    expect(result.error).toBeUndefined();
  });

  test("tests URLs in reverse order (full path first)", async () => {
    const callOrder: string[] = [];
    const tester = vi.fn((url: string) => {
      callOrder.push(url);
      if (url !== "https://connect.dev.com/a") {
        return Promise.reject(new Error("not found"));
      }
      return Promise.resolve();
    });

    const result = await discoverServerURL(
      "https://connect.dev.com/a/b/c",
      tester,
    );
    expect(result.url).toBe("https://connect.dev.com/a");
    expect(callOrder).toEqual([
      "https://connect.dev.com/a/b/c",
      "https://connect.dev.com/a/b",
      "https://connect.dev.com/a",
    ]);
  });

  test("returns original URL and error for invalid URL", async () => {
    const tester = vi.fn(() => Promise.resolve());

    const result = await discoverServerURL("not a valid url", tester);
    expect(result.url).toBe("not a valid url");
    expect(result.error).toBeDefined();
    expect(tester).not.toHaveBeenCalled();
  });
});

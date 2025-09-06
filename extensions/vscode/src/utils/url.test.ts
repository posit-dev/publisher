// Copyright (C) 2025 by Posit Software, PBC.

import { describe, expect, test } from "vitest";
import { formatURL, normalizeConnectURL } from "src/utils/url";

describe("URL util", () => {
  describe("formatURL", () => {
    test("should add https:// to URLs without scheme", () => {
      expect(formatURL("example.com")).toBe("https://example.com");
      expect(formatURL("connect.company.com")).toBe(
        "https://connect.company.com",
      );
    });

    test("should not modify URLs with existing scheme", () => {
      expect(formatURL("https://example.com")).toBe("https://example.com");
      expect(formatURL("http://example.com")).toBe("http://example.com");
    });
  });

  describe("normalizeConnectURL", () => {
    test("should remove /connect suffix from URLs", () => {
      expect(normalizeConnectURL("https://connect.company.com/connect")).toBe(
        "https://connect.company.com",
      );

      expect(normalizeConnectURL("https://connect.company.com/connect/")).toBe(
        "https://connect.company.com",
      );
    });

    test("should remove /connect and everything after it", () => {
      expect(
        normalizeConnectURL("https://connect.company.com/connect/#/welcome"),
      ).toBe("https://connect.company.com");

      expect(
        normalizeConnectURL(
          "https://connect.company.com/connect/#/content/listing",
        ),
      ).toBe("https://connect.company.com");

      expect(
        normalizeConnectURL("https://connect.company.com/connect?param=value"),
      ).toBe("https://connect.company.com");

      expect(
        normalizeConnectURL("https://connect.company.com/connect/some/path"),
      ).toBe("https://connect.company.com");
    });

    test("should handle several sub-domains", () => {
      expect(
        normalizeConnectURL(
          "https://deeply.nested.sub.domain.connect.company.com/connect",
        ),
      ).toBe("https://deeply.nested.sub.domain.connect.company.com");
    });

    test("should not modify URLs without /connect suffix", () => {
      expect(normalizeConnectURL("https://connect.company.com")).toBe(
        "https://connect.company.com",
      );

      expect(normalizeConnectURL("https://connect.company.com/")).toBe(
        "https://connect.company.com/",
      );

      expect(normalizeConnectURL("https://example.com/some/path")).toBe(
        "https://example.com/some/path",
      );
    });

    test("should not remove /connect even if it's part of another word", () => {
      expect(
        normalizeConnectURL("https://connect.company.com/connectapi"),
      ).toBe("https://connect.company.com/connectapi");

      expect(
        normalizeConnectURL("https://connect.company.com/connections"),
      ).toBe("https://connect.company.com/connections");
    });

    test("should handle /connect in custom server paths", () => {
      expect(
        normalizeConnectURL("https://connect.company.com/server/connect"),
      ).toBe("https://connect.company.com/server");

      expect(
        normalizeConnectURL("https://connect.company.com/custom/path/connect/"),
      ).toBe("https://connect.company.com/custom/path");

      expect(
        normalizeConnectURL(
          "https://connect.company.com/server/connect/#/welcome",
        ),
      ).toBe("https://connect.company.com/server");

      expect(
        normalizeConnectURL(
          "https://connect.company.com/app/connect?param=value",
        ),
      ).toBe("https://connect.company.com/app");
    });

    test("should handle non-URL inputs by formatting them first", () => {
      expect(normalizeConnectURL("connect.company.com/connect")).toBe(
        "https://connect.company.com",
      );

      expect(normalizeConnectURL("connect.company.com/connect/#/welcome")).toBe(
        "https://connect.company.com",
      );

      expect(normalizeConnectURL("server.com/app/connect")).toBe(
        "https://server.com/app",
      );
    });

    test("should handle malformed URLs gracefully", () => {
      // Invalid URLs should be returned with formatURL applied
      expect(normalizeConnectURL("not a url at all")).toBe(
        "https://not a url at all",
      );

      expect(normalizeConnectURL("")).toBe("https://");
    });
  });
});

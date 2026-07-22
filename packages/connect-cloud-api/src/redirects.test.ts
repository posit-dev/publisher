// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, it } from "vitest";
import { resolveRequestUrl, MAX_REDIRECTS } from "./redirects.js";

describe("resolveRequestUrl", () => {
  it("joins a relative url with a baseURL without a trailing slash", () => {
    expect(
      resolveRequestUrl({
        baseURL: "https://api.connect.posit.cloud",
        url: "/v1/users/me",
      }),
    ).toBe("https://api.connect.posit.cloud/v1/users/me");
  });

  it("joins a relative url with a baseURL that has a trailing slash", () => {
    expect(
      resolveRequestUrl({
        baseURL: "https://api.connect.posit.cloud/",
        url: "/v1/users/me",
      }),
    ).toBe("https://api.connect.posit.cloud/v1/users/me");
  });

  it("concatenates against a baseURL path prefix (axios-style, not URL resolution)", () => {
    expect(
      resolveRequestUrl({
        baseURL: "https://host.example.com/api",
        url: "/v1/x",
      }),
    ).toBe("https://host.example.com/api/v1/x");
  });

  it("returns an absolute url verbatim, ignoring baseURL", () => {
    expect(
      resolveRequestUrl({
        baseURL: "https://api.connect.posit.cloud",
        url: "https://upload.example.com/presigned",
      }),
    ).toBe("https://upload.example.com/presigned");
  });

  it("returns the baseURL when the url is empty", () => {
    expect(
      resolveRequestUrl({
        baseURL: "https://host.example.com/api",
        url: "",
      }),
    ).toBe("https://host.example.com/api");
  });

  it("returns the baseURL when the url is absent", () => {
    expect(
      resolveRequestUrl({ baseURL: "https://api.connect.posit.cloud" }),
    ).toBe("https://api.connect.posit.cloud");
  });
});

describe("MAX_REDIRECTS", () => {
  it("is 5", () => {
    expect(MAX_REDIRECTS).toBe(5);
  });
});

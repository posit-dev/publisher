// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, it } from "vitest";
import { resolveRequestUrl, MAX_REDIRECTS } from "./redirects.js";

describe("resolveRequestUrl", () => {
  it("joins a relative url with a baseURL without a trailing slash", () => {
    expect(
      resolveRequestUrl({
        baseURL: "https://host.example.com",
        url: "/__api__/v1/user",
      }),
    ).toBe("https://host.example.com/__api__/v1/user");
  });

  it("joins a relative url with a baseURL that has a trailing slash", () => {
    expect(
      resolveRequestUrl({
        baseURL: "https://host.example.com/",
        url: "/__api__/v1/user",
      }),
    ).toBe("https://host.example.com/__api__/v1/user");
  });

  it("concatenates against a baseURL path prefix (axios-style, not URL resolution)", () => {
    // axios joins by concatenation: `https://host/rsc` + `/__api__/x` yields
    // `https://host/rsc/__api__/x`, NOT `https://host/__api__/x`.
    expect(
      resolveRequestUrl({
        baseURL: "https://host.example.com/rsc",
        url: "/__api__/x",
      }),
    ).toBe("https://host.example.com/rsc/__api__/x");
  });

  it("returns an absolute url verbatim, ignoring baseURL", () => {
    expect(
      resolveRequestUrl({
        baseURL: "https://host.example.com",
        url: "https://other-host.example.com/__api__/x",
      }),
    ).toBe("https://other-host.example.com/__api__/x");
  });

  it("returns the baseURL when the url is empty", () => {
    expect(
      resolveRequestUrl({
        baseURL: "https://host.example.com/rsc",
        url: "",
      }),
    ).toBe("https://host.example.com/rsc");
  });

  it("returns the baseURL when the url is absent", () => {
    expect(resolveRequestUrl({ baseURL: "https://host.example.com" })).toBe(
      "https://host.example.com",
    );
  });
});

describe("MAX_REDIRECTS", () => {
  it("is 5", () => {
    expect(MAX_REDIRECTS).toBe(5);
  });
});

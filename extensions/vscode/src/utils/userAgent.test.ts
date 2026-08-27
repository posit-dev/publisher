// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, test, vi } from "vitest";

vi.mock("vscode", () => ({
  extensions: {
    getExtension: vi.fn(),
  },
}));

import { extensions } from "vscode";
import { getExtensionVersion, getUserAgent } from "./userAgent";

describe("getExtensionVersion", () => {
  test("returns the version when the extension is found", () => {
    vi.mocked(extensions.getExtension).mockReturnValue({
      packageJSON: { version: "2.11.4" },
    } as ReturnType<typeof extensions.getExtension>);

    expect(getExtensionVersion()).toBe("2.11.4");
  });

  test("falls back to unknown when the extension is not found", () => {
    vi.mocked(extensions.getExtension).mockReturnValue(undefined);

    expect(getExtensionVersion()).toBe("unknown");
  });
});

describe("getUserAgent", () => {
  test("returns PositPublisher/<version> when the extension is found", () => {
    vi.mocked(extensions.getExtension).mockReturnValue({
      packageJSON: { version: "2.11.4" },
    } as ReturnType<typeof extensions.getExtension>);

    expect(getUserAgent()).toBe("PositPublisher/2.11.4");
  });

  test("falls back to unknown when the extension is not found", () => {
    vi.mocked(extensions.getExtension).mockReturnValue(undefined);

    expect(getUserAgent()).toBe("PositPublisher/unknown");
  });
});

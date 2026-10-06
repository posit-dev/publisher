// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, it } from "vitest";
import { getDashboardUrl, getDirectUrl, getLogsUrl } from "./urlHelpers";

describe("Connect URL helpers", () => {
  it("joins server paths when the server URL has trailing slashes", () => {
    const serverUrl = "https://connect.example.com/base///";

    expect(getDashboardUrl(serverUrl, "content-guid")).toBe(
      "https://connect.example.com/base/connect/#/apps/content-guid",
    );
    expect(getLogsUrl(serverUrl, "content-guid")).toBe(
      "https://connect.example.com/base/connect/#/apps/content-guid/logs",
    );
    expect(getDirectUrl(serverUrl, "content-guid")).toBe(
      "https://connect.example.com/base/content/content-guid/",
    );
  });
});

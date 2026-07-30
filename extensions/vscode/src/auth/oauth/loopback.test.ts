// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, it } from "vitest";
import { renderPage } from "./loopback";

describe("renderPage", () => {
  it("is a self-contained HTML page with the inlined Connect logo and message", () => {
    const html = renderPage(
      "success",
      "Authentication complete",
      "You're signed in to Posit Connect.",
    );

    expect(html.startsWith("<!doctype html>")).toBe(true);
    // Connect wordmark inlined (no external resource requests). The only
    // http(s) URL allowed is the SVG xmlns namespace, never a src/href fetch.
    expect(html).toContain('class="logo"');
    expect(html).toContain('aria-label="Posit Connect"');
    expect(html).not.toMatch(/(?:src|href)\s*=\s*["']https?:/i);
    expect(html).not.toContain("<script");
    // Title and message are rendered.
    expect(html).toContain("Authentication complete");
    expect(html).toContain("You're signed in to Posit Connect.");
    // Success icon.
    expect(html).toContain('aria-label="Success"');
  });

  it("uses the error status icon for the error variant", () => {
    const html = renderPage("error", "Authentication failed", "Try again.");
    expect(html).toContain('aria-label="Failed"');
    expect(html).not.toContain('aria-label="Success"');
    expect(html).toContain("Authentication failed");
  });
});

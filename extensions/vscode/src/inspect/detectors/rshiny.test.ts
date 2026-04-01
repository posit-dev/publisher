// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, describe, expect, test, vi } from "vitest";
import { RShinyDetector } from "./rshiny";
import { ContentType } from "src/api/types/configurations";

const { mockAccess } = vi.hoisted(() => ({
  mockAccess: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  access: mockAccess,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("RShinyDetector", () => {
  const detector = new RShinyDetector();

  test("detects app.R", async () => {
    mockAccess.mockImplementation((path: string) => {
      if (path.endsWith("app.R")) return Promise.resolve();
      return Promise.reject(new Error("ENOENT"));
    });

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.R_SHINY);
    expect(configs[0]?.entrypoint).toBe("app.R");
    expect(configs[0]?.r).toEqual({});
  });

  test("detects server.R", async () => {
    mockAccess.mockImplementation((path: string) => {
      if (path.endsWith("server.R")) return Promise.resolve();
      return Promise.reject(new Error("ENOENT"));
    });

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.entrypoint).toBe("server.R");
  });

  test("detects both app.R and server.R", async () => {
    mockAccess.mockResolvedValue(undefined);

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(2);
  });

  test("returns empty when no R files exist", async () => {
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(0);
  });

  test("skips when entrypoint is not .R", async () => {
    const configs = await detector.inferType("/project", "app.py");
    expect(configs).toHaveLength(0);
  });

  test("filters to specific entrypoint", async () => {
    mockAccess.mockResolvedValue(undefined);

    const configs = await detector.inferType("/project", "app.R");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.entrypoint).toBe("app.R");
  });
});

// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, describe, expect, test, vi } from "vitest";
import { PlumberDetector } from "./plumber";
import { ContentType } from "src/api/types/configurations";

const { mockAccess, mockReadFile, mockReaddir, mockStat } = vi.hoisted(() => ({
  mockAccess: vi.fn(),
  mockReadFile: vi.fn(),
  mockReaddir: vi.fn(),
  mockStat: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  access: mockAccess,
  readFile: mockReadFile,
  readdir: mockReaddir,
  stat: mockStat,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("PlumberDetector", () => {
  const detector = new PlumberDetector();

  test("detects plumber.R", async () => {
    mockReaddir.mockResolvedValue(["plumber.R"]);
    mockStat.mockResolvedValue({ isFile: () => true });
    mockAccess.mockResolvedValue(undefined);
    // No server file
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const configs = await detector.inferType("/project", "plumber.R");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.R_PLUMBER);
    expect(configs[0]?.entrypoint).toBe("plumber.R");
    expect(configs[0]?.files).toEqual(["/plumber.R"]);
    expect(configs[0]?.r).toEqual({});
  });

  test("detects entrypoint.R", async () => {
    mockReaddir.mockResolvedValue(["entrypoint.R"]);
    mockStat.mockResolvedValue({ isFile: () => true });
    mockAccess.mockResolvedValue(undefined);
    // No server file
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const configs = await detector.inferType("/project", "entrypoint.R");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.R_PLUMBER);
    expect(configs[0]?.entrypoint).toBe("entrypoint.R");
    expect(configs[0]?.files).toEqual(["/entrypoint.R"]);
    expect(configs[0]?.r).toEqual({});
  });

  test("returns empty for non-R entrypoints", async () => {
    const configs = await detector.inferType("/project", "report.Rmd");
    expect(configs).toHaveLength(0);
  });

  test("detects via _server.yml with single route", async () => {
    const serverYml = `engine: plumber
routes: app/plumber.R
`;
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.endsWith("_server.yml")) {
        return Promise.resolve(serverYml);
      }
      return Promise.reject(new Error("ENOENT"));
    });

    const configs = await detector.inferType("/project", "app.R");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.R_PLUMBER);
    expect(configs[0]?.entrypoint).toBe("app.R");
    expect(configs[0]?.files).toEqual(["/_server.yml", "/app/plumber.R"]);
    expect(configs[0]?.r).toEqual({});
  });

  test("detects via _server.yaml with multiple routes", async () => {
    const serverYaml = `engine: plumber
routes:
  - app/one.R
  - app/two.R
  - app/three.R
`;
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.endsWith("_server.yml")) {
        return Promise.reject(new Error("ENOENT"));
      }
      if (filePath.endsWith("_server.yaml")) {
        return Promise.resolve(serverYaml);
      }
      return Promise.reject(new Error("ENOENT"));
    });

    const configs = await detector.inferType("/project", "app.R");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.R_PLUMBER);
    expect(configs[0]?.entrypoint).toBe("app.R");
    expect(configs[0]?.files).toEqual([
      "/_server.yaml",
      "/app/one.R",
      "/app/two.R",
      "/app/three.R",
    ]);
    expect(configs[0]?.r).toEqual({});
  });

  test("server YAML as entrypoint", async () => {
    const serverYaml = `engine: plumber
routes:
  - app/one.R
  - app/two.R
  - app/three.R
`;
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.endsWith("_server.yml")) {
        return Promise.reject(new Error("ENOENT"));
      }
      if (filePath.endsWith("_server.yaml")) {
        return Promise.resolve(serverYaml);
      }
      return Promise.reject(new Error("ENOENT"));
    });

    const configs = await detector.inferType("/project", "_server.yaml");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.R_PLUMBER);
    expect(configs[0]?.entrypoint).toBe("_server.yaml");
    expect(configs[0]?.files).toEqual([
      "/_server.yaml",
      "/app/one.R",
      "/app/two.R",
      "/app/three.R",
    ]);
    expect(configs[0]?.r).toEqual({});
  });

  test("includes constructor file from server YAML", async () => {
    const serverYml = `engine: plumber
constructor: setup.R
routes: app/plumber.R
`;
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.endsWith("_server.yml")) {
        return Promise.resolve(serverYml);
      }
      return Promise.reject(new Error("ENOENT"));
    });

    const configs = await detector.inferType("/project", "app.R");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.files).toEqual([
      "/_server.yml",
      "/setup.R",
      "/app/plumber.R",
    ]);
  });

  test("skips server file with non-plumber engine", async () => {
    const serverYml = `engine: flask
routes: app.py
`;
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.endsWith("_server.yml")) {
        return Promise.resolve(serverYml);
      }
      return Promise.reject(new Error("ENOENT"));
    });
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const configs = await detector.inferType("/project", "app.R");
    expect(configs).toHaveLength(0);
  });

  test("discovers entrypoints without explicit entrypoint", async () => {
    // No server files
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    // Directory has plumber.R
    mockReaddir.mockResolvedValue(["plumber.R", "utils.R"]);
    mockStat.mockResolvedValue({ isFile: () => true });

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.R_PLUMBER);
    expect(configs[0]?.entrypoint).toBe("plumber.R");
  });
});

// Copyright (C) 2026 by Posit Software, PBC.

import { beforeEach, describe, expect, test, vi } from "vitest";
import { getInterpreterDefaults } from "./index";

const { mockDetectPython, mockDetectR } = vi.hoisted(() => ({
  mockDetectPython: vi.fn(),
  mockDetectR: vi.fn(),
}));

vi.mock("./pythonInterpreter", () => ({
  detectPythonInterpreter: mockDetectPython,
}));

vi.mock("./rInterpreter", () => ({
  detectRInterpreter: mockDetectR,
}));

describe("getInterpreterDefaults", () => {
  beforeEach(() => {
    mockDetectPython.mockReset();
    mockDetectR.mockReset();
  });

  test("returns results when both detections succeed", async () => {
    mockDetectPython.mockResolvedValue({
      config: {
        version: "3.11.5",
        packageFile: "requirements.txt",
        packageManager: "auto",
      },
      preferredPath: "/usr/bin/python3",
    });
    mockDetectR.mockResolvedValue({
      config: {
        version: "4.3.2",
        packageFile: "renv.lock",
        packageManager: "renv",
      },
      preferredPath: "/usr/bin/R",
    });

    const result = await getInterpreterDefaults(
      "/project",
      "/usr/bin/python3",
      "/usr/bin/R",
    );

    expect(result.python).toEqual({
      version: "3.11.5",
      packageFile: "requirements.txt",
      packageManager: "auto",
    });
    expect(result.preferredPythonPath).toBe("/usr/bin/python3");
    expect(result.r).toEqual({
      version: "4.3.2",
      packageFile: "renv.lock",
      packageManager: "renv",
    });
    expect(result.preferredRPath).toBe("/usr/bin/R");
  });

  test("returns empty Python config when Python detection rejects", async () => {
    mockDetectPython.mockRejectedValue(new Error("python exploded"));
    mockDetectR.mockResolvedValue({
      config: {
        version: "4.3.2",
        packageFile: "renv.lock",
        packageManager: "renv",
      },
      preferredPath: "/usr/bin/R",
    });

    const result = await getInterpreterDefaults(
      "/project",
      "/usr/bin/python3",
      "/usr/bin/R",
    );

    expect(result.python).toEqual({
      version: "",
      packageFile: "",
      packageManager: "",
    });
    expect(result.preferredPythonPath).toBe("/usr/bin/python3");
    // R still succeeds
    expect(result.r.version).toBe("4.3.2");
  });

  test("returns empty R config when R detection rejects", async () => {
    mockDetectPython.mockResolvedValue({
      config: {
        version: "3.11.5",
        packageFile: "requirements.txt",
        packageManager: "auto",
      },
      preferredPath: "/usr/bin/python3",
    });
    mockDetectR.mockRejectedValue(new Error("R exploded"));

    const result = await getInterpreterDefaults(
      "/project",
      "/usr/bin/python3",
      "/usr/bin/R",
    );

    // Python still succeeds
    expect(result.python.version).toBe("3.11.5");
    expect(result.r).toEqual({
      version: "",
      packageFile: "",
      packageManager: "",
    });
    expect(result.preferredRPath).toBe("/usr/bin/R");
  });

  test("returns empty configs when both detections reject", async () => {
    mockDetectPython.mockRejectedValue(new Error("python exploded"));
    mockDetectR.mockRejectedValue(new Error("R exploded"));

    const result = await getInterpreterDefaults(
      "/project",
      "/usr/bin/python3",
      "/usr/bin/R",
    );

    expect(result.python).toEqual({
      version: "",
      packageFile: "",
      packageManager: "",
    });
    expect(result.r).toEqual({
      version: "",
      packageFile: "",
      packageManager: "",
    });
  });

  test("handles undefined paths in rejection fallback", async () => {
    mockDetectPython.mockRejectedValue(new Error("fail"));
    mockDetectR.mockRejectedValue(new Error("fail"));

    const result = await getInterpreterDefaults("/project");

    expect(result.preferredPythonPath).toBe("");
    expect(result.preferredRPath).toBe("");
  });

  test("passes paths through to detectors", async () => {
    mockDetectPython.mockResolvedValue({
      config: { version: "", packageFile: "", packageManager: "" },
      preferredPath: "",
    });
    mockDetectR.mockResolvedValue({
      config: { version: "", packageFile: "", packageManager: "" },
      preferredPath: "",
    });

    await getInterpreterDefaults("/project", "/my/python", "/my/R");

    expect(mockDetectPython).toHaveBeenCalledWith("/project", "/my/python");
    expect(mockDetectR).toHaveBeenCalledWith("/project", "/my/R");
  });
});

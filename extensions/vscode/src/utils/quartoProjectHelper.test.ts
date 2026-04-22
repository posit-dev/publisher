// Copyright (C) 2025 by Posit Software, PBC.

import * as path from "path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  ErrorNoQuarto,
  ErrorQuartoRender,
  QuartoProjectHelper,
} from "./quartoProjectHelper";

const mockQuartoCheck = vi.fn().mockResolvedValue(0);
const mockRenderCmd = vi.fn().mockResolvedValue(0);
vi.mock("./window", () => {
  return {
    runTerminalCommand: vi.fn().mockImplementation((cmd: string) => {
      if (cmd === "quarto --version") {
        return mockQuartoCheck(cmd);
      }
      return mockRenderCmd(cmd);
    }),
  };
});

const mockFileExistsAt = vi.fn();
vi.mock("../interpreters/fsUtils", () => ({
  fileExistsAt: (...args: unknown[]) => mockFileExistsAt(...args),
}));

describe("QuartoProjectHelper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("one level workspace", () => {
    test("not a project, _quarto.yml does not exist, calls to render document", async () => {
      mockFileExistsAt.mockResolvedValue(false);

      const helper = new QuartoProjectHelper("index.qmd", "index.html", ".");
      await helper.render();
      expect(mockRenderCmd).toHaveBeenCalledWith(
        `quarto render "${path.join(".", "index.qmd")}" --to html`,
      );
    });

    test("it is a project, _quarto.yml present, renders as a project (uses dir)", async () => {
      mockFileExistsAt.mockResolvedValue(true);

      const helper = new QuartoProjectHelper("index.qmd", "index.html", ".");
      await helper.render();
      expect(mockRenderCmd).toHaveBeenCalledWith(`quarto render "." --to html`);
    });

    test("source is _quarto.yml, renders as a project (uses dir)", async () => {
      const helper = new QuartoProjectHelper("_quarto.yml", "index.html", ".");
      await helper.render();
      // No need to check on files if source is already the .yml
      expect(mockFileExistsAt).not.toHaveBeenCalled();
      expect(mockRenderCmd).toHaveBeenCalledWith(`quarto render "." --to html`);
    });
  });

  describe("multi-level workspace", () => {
    const projectDir = path.join("march-reports", "src");
    const sourceEntrypoint = "index.qmd";

    test("not a project, _quarto.yml does not exist, calls to render document", async () => {
      mockFileExistsAt.mockResolvedValue(false);

      const helper = new QuartoProjectHelper(
        sourceEntrypoint,
        "index.html",
        projectDir,
      );
      await helper.render();
      expect(mockRenderCmd).toHaveBeenCalledWith(
        `quarto render "${path.join(projectDir, sourceEntrypoint)}" --to html`,
      );
    });

    test("it is a project, _quarto.yml present, renders as a project (uses dir)", async () => {
      mockFileExistsAt.mockResolvedValue(true);

      const helper = new QuartoProjectHelper(
        sourceEntrypoint,
        "index.html",
        projectDir,
      );
      await helper.render();
      expect(mockRenderCmd).toHaveBeenCalledWith(
        `quarto render "${projectDir}" --to html`,
      );
    });

    test("source is _quarto.yml, renders as a project (uses dir)", async () => {
      const helper = new QuartoProjectHelper(
        "_quarto.yml",
        "index.html",
        projectDir,
      );
      await helper.render();
      // No need to check on files if source is already the .yml
      expect(mockFileExistsAt).not.toHaveBeenCalled();
      expect(mockRenderCmd).toHaveBeenCalledWith(
        `quarto render "${projectDir}" --to html`,
      );
    });
  });

  describe("rootDir resolves relative projectDir", () => {
    const rootDir = path.join(path.sep, "workspace", "my project");

    test("relative projectDir is resolved against rootDir", async () => {
      mockFileExistsAt.mockResolvedValue(false);

      const helper = new QuartoProjectHelper(
        "index.qmd",
        "index.html",
        ".",
        rootDir,
      );
      expect(helper.projectDir).toBe(rootDir);
      await helper.render();
      expect(mockRenderCmd).toHaveBeenCalledWith(
        `quarto render "${path.join(rootDir, "index.qmd")}" --to html`,
      );
    });

    test("nested relative projectDir is resolved against rootDir", async () => {
      mockFileExistsAt.mockResolvedValue(true);

      const relProjectDir = path.join("sub", "dir");
      const helper = new QuartoProjectHelper(
        "index.qmd",
        "index.html",
        relProjectDir,
        rootDir,
      );
      const expected = path.resolve(rootDir, relProjectDir);
      expect(helper.projectDir).toBe(expected);
      await helper.render();
      expect(mockRenderCmd).toHaveBeenCalledWith(
        `quarto render "${expected}" --to html`,
      );
    });

    test("absolute projectDir is unchanged when rootDir is provided", () => {
      const absProjectDir = path.join(path.sep, "already", "absolute");
      const helper = new QuartoProjectHelper(
        "index.qmd",
        "index.html",
        absProjectDir,
        rootDir,
      );
      expect(helper.projectDir).toBe(absProjectDir);
    });

    test("projectDir is unchanged when rootDir is omitted", () => {
      const helper = new QuartoProjectHelper("index.qmd", "index.html", ".");
      expect(helper.projectDir).toBe(".");
    });
  });

  describe("errors", () => {
    test("there is no quarto binary", async () => {
      mockFileExistsAt.mockResolvedValue(false);
      mockQuartoCheck.mockRejectedValueOnce(new Error("oops"));

      const helper = new QuartoProjectHelper("index.qmd", "index.html", ".");

      try {
        await helper.render();
      } catch (err) {
        expect(err).toBeInstanceOf(ErrorNoQuarto);
      }
    });

    test("could not render", async () => {
      mockFileExistsAt.mockResolvedValue(false);
      mockRenderCmd.mockRejectedValueOnce(
        new Error("Quarto cannot render lettuce"),
      );
      mockRenderCmd.mockRejectedValueOnce(1);

      const helper = new QuartoProjectHelper("index.qmd", "index.html", ".");

      try {
        await helper.render();
      } catch (err) {
        expect(err).toBeInstanceOf(ErrorQuartoRender);
      }
    });
  });
});

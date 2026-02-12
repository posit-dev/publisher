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

const quartoProjFiles = () => [
  { id: "index.qmd", files: [] },
  { id: "about.qmd", files: [] },
  { id: "gallery.qmd", files: [] },
  { id: "some-data.csv", files: [] },
  { id: "README.md", files: [] },
];

const multiLevelProj = () => [
  { id: "some-data.csv", files: [] },
  { id: "README.md", files: [] },
  {
    id: "march-reports",
    files: [
      { id: "documentation.html" },
      {
        id: "src",
        files: [
          {
            id: "assets",
            files: [
              { id: "image.png" },
              { id: "styles.css" },
              { id: "whatever.js" },
            ],
          },
          { id: "index.qmd", files: [] },
          { id: "about.qmd", files: [] },
          { id: "gallery.qmd", files: [] },
        ],
      },
      { id: "scripts.sh" },
    ],
  },
];

const multiLevelProjWithQuartoYml = () => {
  const tree = multiLevelProj();
  const level2 = tree[2];
  const level3 = level2?.files?.[1];
  if (level3?.files) {
    level3.files.push({ id: "_quarto.yml", files: [] });
  }
  return tree;
};

const singleLevelProjectDir = {
  withQuartoYml: [...quartoProjFiles(), { id: "_quarto.yml", files: [] }],
  noQuartoYml: quartoProjFiles(),
};

const multiLevelProjectDir = {
  withQuartoYml: multiLevelProjWithQuartoYml(),
  noQuartoYml: multiLevelProj(),
};

const filesGetFn = vi.fn();
filesGetFn.mockResolvedValue({
  data: {
    id: ".",
    files: singleLevelProjectDir.withQuartoYml,
  },
});

const mockFilesApi = {
  get() {
    return filesGetFn();
  },
};

describe("QuartoProjectHelper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("one level workspace", () => {
    test("not a project, _quarto.yml does not exist, calls to render document", async () => {
      filesGetFn.mockResolvedValue({
        data: {
          id: ".",
          files: singleLevelProjectDir.noQuartoYml,
        },
      });

      const helper = new QuartoProjectHelper(
        mockFilesApi,
        "index.qmd",
        "index.html",
        ".",
      );
      await helper.render();
      expect(mockRenderCmd).toHaveBeenCalledWith(
        "quarto render index.qmd --to html",
      );
    });

    test("it is a project, _quarto.yml present, renders as a project (uses dir)", async () => {
      filesGetFn.mockResolvedValue({
        data: {
          id: ".",
          files: singleLevelProjectDir.withQuartoYml,
        },
      });

      const helper = new QuartoProjectHelper(
        mockFilesApi,
        "index.qmd",
        "index.html",
        ".",
      );
      await helper.render();
      expect(mockRenderCmd).toHaveBeenCalledWith("quarto render . --to html");
    });

    test("source is _quarto.yml, renders as a project (uses dir)", async () => {
      const helper = new QuartoProjectHelper(
        mockFilesApi,
        "_quarto.yml",
        "index.html",
        ".",
      );
      await helper.render();
      // No need to check on files if source is already the .yml
      expect(filesGetFn).not.toHaveBeenCalled();
      expect(mockRenderCmd).toHaveBeenCalledWith("quarto render . --to html");
    });
  });

  describe("multi-level workspace", () => {
    const projectDir = path.join("march-reports", "src");
    const sourceEntrypoint = "index.qmd";

    test("not a project, _quarto.yml does not exist, calls to render document", async () => {
      filesGetFn.mockResolvedValue({
        data: {
          id: ".",
          files: multiLevelProjectDir.noQuartoYml,
        },
      });

      const helper = new QuartoProjectHelper(
        mockFilesApi,
        sourceEntrypoint,
        "index.html",
        projectDir,
      );
      await helper.render();
      expect(mockRenderCmd).toHaveBeenCalledWith(
        `quarto render ${path.join(projectDir, sourceEntrypoint)} --to html`,
      );
    });

    test("it is a project, _quarto.yml present, renders as a project (uses dir)", async () => {
      filesGetFn.mockResolvedValue({
        data: {
          id: ".",
          files: multiLevelProjectDir.withQuartoYml,
        },
      });

      const helper = new QuartoProjectHelper(
        mockFilesApi,
        sourceEntrypoint,
        "index.html",
        projectDir,
      );
      await helper.render();
      expect(mockRenderCmd).toHaveBeenCalledWith(
        `quarto render ${projectDir} --to html`,
      );
    });

    test("source is _quarto.yml, renders as a project (uses dir)", async () => {
      const helper = new QuartoProjectHelper(
        mockFilesApi,
        "_quarto.yml",
        "index.html",
        projectDir,
      );
      await helper.render();
      // No need to check on files if source is already the .yml
      expect(filesGetFn).not.toHaveBeenCalled();
      expect(mockRenderCmd).toHaveBeenCalledWith(
        `quarto render ${projectDir} --to html`,
      );
    });
  });

  describe("errors", () => {
    test("there is no quarto binary", async () => {
      filesGetFn.mockResolvedValue({
        data: {
          id: ".",
          files: singleLevelProjectDir.noQuartoYml,
        },
      });

      mockQuartoCheck.mockRejectedValueOnce(new Error("oops"));

      const helper = new QuartoProjectHelper(
        mockFilesApi,
        "index.qmd",
        "index.html",
        ".",
      );

      try {
        await helper.render();
      } catch (err) {
        expect(err).toBeInstanceOf(ErrorNoQuarto);
      }
    });

    test("could not render", async () => {
      filesGetFn.mockResolvedValue({
        data: {
          id: ".",
          files: singleLevelProjectDir.noQuartoYml,
        },
      });

      mockRenderCmd.mockRejectedValueOnce(
        new Error("Quarto cannot render lettuce"),
      );
      mockRenderCmd.mockRejectedValueOnce(1);

      const helper = new QuartoProjectHelper(
        mockFilesApi,
        "index.qmd",
        "index.html",
        ".",
      );

      try {
        await helper.render();
      } catch (err) {
        expect(err).toBeInstanceOf(ErrorQuartoRender);
      }
    });
  });
});

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

const multiLevelProjWithRendering = () => {
  const tree = multiLevelProj();
  tree[2].files[1].files!.push({ id: "index.html", files: [] });
  return tree;
};

const multiLevelProjWithOutputDir = () => {
  const tree = multiLevelProj();
  tree[2].files[1].files!.push({
    id: "_output-dirz",
    files: [{ id: "index.html" }],
  });
  return tree;
};

const singleLevelProjectDir = {
  withRendering: [...quartoProjFiles(), { id: "index.html", files: [] }],
  noRendering: quartoProjFiles(),
  outputDirWithRendering: [
    ...quartoProjFiles(),
    {
      id: "_output-dirz",
      files: [{ id: "index.html" }],
    },
  ],
};

const multiLevelProjectDir = {
  withRendering: multiLevelProjWithRendering(),
  noRendering: multiLevelProj(),
  outputDirWithRendering: multiLevelProjWithOutputDir(),
};

const filesGetFn = vi.fn();
filesGetFn.mockResolvedValue({
  data: {
    id: ".",
    files: singleLevelProjectDir.withRendering,
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
    describe("doc as entrypoint", () => {
      test("rendering exists, does not call extension", async () => {
        const helper = new QuartoProjectHelper(
          mockFilesApi,
          "index.qmd",
          "index.html",
          ".",
        );
        await helper.verifyRenderedOutput();
        expect(mockRenderCmd).not.toHaveBeenCalled();
      });

      test("rendering does not exist, calls to render with quarto", async () => {
        filesGetFn.mockResolvedValue({
          data: {
            id: ".",
            files: singleLevelProjectDir.noRendering,
          },
        });

        const helper = new QuartoProjectHelper(
          mockFilesApi,
          "index.qmd",
          "index.html",
          ".",
        );
        await helper.verifyRenderedOutput();
        expect(mockRenderCmd).toHaveBeenCalledWith("quarto render . --to html");
      });

      test("fails to render project, attempts to render standalone document", async () => {
        filesGetFn.mockResolvedValue({
          data: {
            id: ".",
            files: singleLevelProjectDir.noRendering,
          },
        });

        mockRenderCmd.mockRejectedValueOnce(1);

        const helper = new QuartoProjectHelper(
          mockFilesApi,
          "index.qmd",
          "index.html",
          ".",
        );
        await helper.verifyRenderedOutput();
        expect(mockRenderCmd).toHaveBeenCalledWith("quarto render . --to html");
        expect(mockRenderCmd).toHaveBeenCalledWith(
          "quarto render index.qmd --to html",
        );
      });
    });

    describe("output-dir rendering", () => {
      const outputDir = path.join("_output-dirz", "index.html");

      test("rendering exists, does not call extension", async () => {
        filesGetFn.mockResolvedValue({
          data: {
            id: ".",
            files: singleLevelProjectDir.outputDirWithRendering,
          },
        });

        const helper = new QuartoProjectHelper(
          mockFilesApi,
          "index.qmd",
          outputDir,
          ".",
        );
        await helper.verifyRenderedOutput();
        expect(mockRenderCmd).not.toHaveBeenCalled();
      });

      test("rendering does not exist, calls to render with quarto", async () => {
        filesGetFn.mockResolvedValue({
          data: {
            id: ".",
            files: singleLevelProjectDir.noRendering,
          },
        });

        const helper = new QuartoProjectHelper(
          mockFilesApi,
          "index.qmd",
          outputDir,
          ".",
        );
        await helper.verifyRenderedOutput();
        expect(mockRenderCmd).toHaveBeenCalledWith("quarto render . --to html");
      });
    });
  });

  describe("multi-level workspace", () => {
    const projectDir = path.join("march-reports", "src");
    const sourceEntrypoint = "index.qmd";

    describe("single doc rendering", () => {
      test("rendering exists, does not call extension", async () => {
        filesGetFn.mockResolvedValue({
          data: {
            id: ".",
            files: multiLevelProjectDir.withRendering,
          },
        });

        const helper = new QuartoProjectHelper(
          mockFilesApi,
          sourceEntrypoint,
          "index.html",
          projectDir,
        );
        await helper.verifyRenderedOutput();
        expect(mockRenderCmd).not.toHaveBeenCalled();
      });

      test("rendering does not exist, calls to render with quarto", async () => {
        filesGetFn.mockResolvedValue({
          data: {
            id: ".",
            files: multiLevelProjectDir.noRendering,
          },
        });

        const helper = new QuartoProjectHelper(
          mockFilesApi,
          sourceEntrypoint,
          "index.html",
          projectDir,
        );
        await helper.verifyRenderedOutput();
        expect(mockRenderCmd).toHaveBeenCalledWith(
          `quarto render ${projectDir} --to html`,
        );
      });

      test("fails to render project, attempts to render standalone document", async () => {
        filesGetFn.mockResolvedValue({
          data: {
            id: ".",
            files: multiLevelProjectDir.noRendering,
          },
        });

        mockRenderCmd.mockRejectedValueOnce(1);

        const helper = new QuartoProjectHelper(
          mockFilesApi,
          sourceEntrypoint,
          "index.html",
          projectDir,
        );
        await helper.verifyRenderedOutput();
        expect(mockRenderCmd).toHaveBeenCalledWith(
          `quarto render ${projectDir} --to html`,
        );
        expect(mockRenderCmd).toHaveBeenCalledWith(
          `quarto render ${path.join(projectDir, sourceEntrypoint)} --to html`,
        );
      });
    });

    describe("output-dir rendering", () => {
      const outputDir = path.join("_output-dirz", "index.html");

      test("rendering exists, does not call extension", async () => {
        filesGetFn.mockResolvedValue({
          data: {
            id: ".",
            files: multiLevelProjectDir.outputDirWithRendering,
          },
        });

        const helper = new QuartoProjectHelper(
          mockFilesApi,
          sourceEntrypoint,
          outputDir,
          projectDir,
        );
        await helper.verifyRenderedOutput();
        expect(mockRenderCmd).not.toHaveBeenCalled();
      });

      test("rendering does not exist, calls to render with quarto", async () => {
        filesGetFn.mockResolvedValue({
          data: {
            id: ".",
            files: multiLevelProjectDir.noRendering,
          },
        });

        const helper = new QuartoProjectHelper(
          mockFilesApi,
          sourceEntrypoint,
          outputDir,
          projectDir,
        );
        await helper.verifyRenderedOutput();
        expect(mockRenderCmd).toHaveBeenCalledWith(
          `quarto render ${projectDir} --to html`,
        );
      });
    });
  });

  describe("errors", () => {
    test("there is no quarto binary", async () => {
      filesGetFn.mockResolvedValue({
        data: {
          id: ".",
          files: singleLevelProjectDir.noRendering,
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

    test("could not render by any means", async () => {
      filesGetFn.mockResolvedValue({
        data: {
          id: ".",
          files: singleLevelProjectDir.noRendering,
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

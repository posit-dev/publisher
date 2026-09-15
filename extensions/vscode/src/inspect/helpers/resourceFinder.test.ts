// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, describe, expect, test, vi } from "vitest";
import { findLinkedResources } from "./resourceFinder";

const { mockReadFile, mockStat, mockReaddir } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockStat: vi.fn(),
  mockReaddir: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  readFile: mockReadFile,
  stat: mockStat,
  readdir: mockReaddir,
}));

vi.mock("src/logging", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

// Helper: make mockStat resolve for specific paths, reject for others
function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

function setupFiles(existingPaths: Record<string, "file" | "directory">) {
  mockStat.mockImplementation((filePath: string) => {
    const normalized = normalizePath(filePath);
    for (const [p, type] of Object.entries(existingPaths)) {
      if (normalized === p || normalized.endsWith(p)) {
        return Promise.resolve({
          isFile: () => type === "file",
          isDirectory: () => type === "directory",
        });
      }
    }
    return Promise.reject(new Error("ENOENT"));
  });
}

// Helper: make mockReadFile return content for specific paths
function setupFileContents(contents: Record<string, string>) {
  mockReadFile.mockImplementation((filePath: string) => {
    const normalized = normalizePath(filePath);
    for (const [p, content] of Object.entries(contents)) {
      if (normalized === p || normalized.endsWith(p)) {
        return Promise.resolve(content);
      }
    }
    return Promise.reject(new Error("ENOENT"));
  });
}

describe("findLinkedResources", () => {
  // ---- Markdown ----

  describe("markdown scanning", () => {
    test("discovers image references", async () => {
      setupFileContents({
        "/project/doc.qmd": "# Hello\n\n![A logo](images/logo.png)\n",
      });
      setupFiles({
        "/project/doc.qmd": "file",
        "/project/images/logo.png": "file",
      });

      const result = await findLinkedResources("/project", ["/doc.qmd"]);
      expect(result).toContain("/images/logo.png");
    });

    test("discovers image references with title text", async () => {
      setupFileContents({
        "/project/doc.md": '![alt](images/photo.jpg "Photo title")\n',
      });
      setupFiles({
        "/project/doc.md": "file",
        "/project/images/photo.jpg": "file",
      });

      const result = await findLinkedResources("/project", ["/doc.md"]);
      expect(result).toContain("/images/photo.jpg");
    });

    test("discovers HTML links to .html files only", async () => {
      setupFileContents({
        "/project/doc.rmd":
          "[page](other.html)\n[pdf](report.pdf)\n[site](about.htm)\n",
      });
      setupFiles({
        "/project/doc.rmd": "file",
        "/project/other.html": "file",
        "/project/report.pdf": "file",
        "/project/about.htm": "file",
      });

      const result = await findLinkedResources("/project", ["/doc.rmd"]);
      expect(result).toContain("/other.html");
      expect(result).toContain("/about.htm");
      expect(result).not.toContain("/report.pdf");
    });

    test("discovers inline HTML img tags in markdown", async () => {
      setupFileContents({
        "/project/doc.qmd": '<img src="fig1.png" alt="figure">\n',
      });
      setupFiles({
        "/project/doc.qmd": "file",
        "/project/fig1.png": "file",
      });

      const result = await findLinkedResources("/project", ["/doc.qmd"]);
      expect(result).toContain("/fig1.png");
    });

    test("does not scan content inside YAML front matter", async () => {
      setupFileContents({
        "/project/doc.qmd":
          "---\ntitle: My Doc\npreview: ![](images/yaml-image.png)\n---\n\n![](images/real.png)\n",
      });
      setupFiles({
        "/project/doc.qmd": "file",
        "/project/images/real.png": "file",
        "/project/images/yaml-image.png": "file",
      });

      const result = await findLinkedResources("/project", ["/doc.qmd"]);
      expect(result).toContain("/images/real.png");
      expect(result).not.toContain("/images/yaml-image.png");
    });

    test("does not treat horizontal rule --- as YAML delimiter", async () => {
      setupFileContents({
        "/project/doc.qmd":
          "---\ntitle: My Doc\n---\n\n![](images/before.png)\n\n---\n\n![](images/after.png)\n",
      });
      setupFiles({
        "/project/doc.qmd": "file",
        "/project/images/before.png": "file",
        "/project/images/after.png": "file",
      });

      const result = await findLinkedResources("/project", ["/doc.qmd"]);
      expect(result).toContain("/images/before.png");
      expect(result).toContain("/images/after.png");
    });
  });

  // ---- YAML resource_files ----

  describe("YAML resource_files parsing", () => {
    test("discovers explicitly declared resource files", async () => {
      setupFileContents({
        "/project/doc.qmd":
          "---\nresource_files:\n- data/input.csv\n- assets/style.css\n---\n\nContent\n",
      });
      setupFiles({
        "/project/doc.qmd": "file",
        "/project/data/input.csv": "file",
        "/project/assets/style.css": "file",
      });

      const result = await findLinkedResources("/project", ["/doc.qmd"]);
      expect(result).toContain("/data/input.csv");
      expect(result).toContain("/assets/style.css");
    });

    test("handles quoted paths in resource_files", async () => {
      setupFileContents({
        "/project/doc.rmd":
          "---\nresource_files:\n- \"data/input.csv\"\n- 'assets/style.css'\n---\n",
      });
      setupFiles({
        "/project/doc.rmd": "file",
        "/project/data/input.csv": "file",
        "/project/assets/style.css": "file",
      });

      const result = await findLinkedResources("/project", ["/doc.rmd"]);
      expect(result).toContain("/data/input.csv");
      expect(result).toContain("/assets/style.css");
    });

    test("expands glob patterns in resource_files", async () => {
      setupFileContents({
        "/project/doc.qmd":
          "---\nresource_files:\n- data/*.csv\n---\n\nContent\n",
      });
      setupFiles({
        "/project/doc.qmd": "file",
        "/project/data/a.csv": "file",
        "/project/data/b.csv": "file",
      });
      mockReaddir.mockImplementation((dirPath: string) => {
        if (dirPath.replace(/\\/g, "/").endsWith("/project")) {
          return Promise.resolve([
            { name: "data", isFile: () => false, isDirectory: () => true },
            { name: "doc.qmd", isFile: () => true, isDirectory: () => false },
          ]);
        }
        if (dirPath.replace(/\\/g, "/").endsWith("/project/data")) {
          return Promise.resolve([
            { name: "a.csv", isFile: () => true, isDirectory: () => false },
            { name: "b.csv", isFile: () => true, isDirectory: () => false },
          ]);
        }
        return Promise.resolve([]);
      });

      const result = await findLinkedResources("/project", ["/doc.qmd"]);
      expect(result).toContain("/data/a.csv");
      expect(result).toContain("/data/b.csv");
    });

    test("walks directories declared in resource_files", async () => {
      setupFileContents({
        "/project/doc.qmd": "---\nresource_files:\n- assets\n---\n\nContent\n",
      });
      setupFiles({
        "/project/doc.qmd": "file",
        "/project/assets": "directory",
        "/project/assets/logo.png": "file",
        "/project/assets/style.css": "file",
      });
      mockReaddir.mockImplementation((dirPath: string) => {
        if (dirPath.replace(/\\/g, "/").endsWith("/project/assets")) {
          return Promise.resolve([
            { name: "logo.png", isFile: () => true, isDirectory: () => false },
            {
              name: "style.css",
              isFile: () => true,
              isDirectory: () => false,
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const result = await findLinkedResources("/project", ["/doc.qmd"]);
      expect(result).toContain("/assets/logo.png");
      expect(result).toContain("/assets/style.css");
    });
  });

  // ---- HTML ----

  describe("HTML scanning", () => {
    test("discovers resources from common HTML tags", async () => {
      setupFileContents({
        "/project/index.html": [
          '<img src="logo.png">',
          '<link href="styles/main.css" rel="stylesheet">',
          '<script src="js/app.js"></script>',
          '<video src="media/intro.mp4"></video>',
          '<audio src="media/sound.mp3"></audio>',
          '<source src="media/alt.webm">',
        ].join("\n"),
      });
      setupFiles({
        "/project/index.html": "file",
        "/project/logo.png": "file",
        "/project/styles/main.css": "file",
        "/project/js/app.js": "file",
        "/project/media/intro.mp4": "file",
        "/project/media/sound.mp3": "file",
        "/project/media/alt.webm": "file",
      });

      const result = await findLinkedResources("/project", ["/index.html"]);
      expect(result).toContain("/logo.png");
      expect(result).toContain("/styles/main.css");
      expect(result).toContain("/js/app.js");
      expect(result).toContain("/media/intro.mp4");
      expect(result).toContain("/media/sound.mp3");
      expect(result).toContain("/media/alt.webm");
    });

    test("handles single and double quoted attributes", async () => {
      setupFileContents({
        "/project/page.html": "<img src='a.png'>\n<img src=\"b.png\">\n",
      });
      setupFiles({
        "/project/page.html": "file",
        "/project/a.png": "file",
        "/project/b.png": "file",
      });

      const result = await findLinkedResources("/project", ["/page.html"]);
      expect(result).toContain("/a.png");
      expect(result).toContain("/b.png");
    });
  });

  // ---- CSS ----

  describe("CSS scanning", () => {
    test("discovers url() references", async () => {
      setupFileContents({
        "/project/styles.css":
          'body { background: url("images/bg.jpg"); }\n@font-face { src: url(fonts/Lato.ttf); }\n',
      });
      setupFiles({
        "/project/styles.css": "file",
        "/project/images/bg.jpg": "file",
        "/project/fonts/Lato.ttf": "file",
      });

      const result = await findLinkedResources("/project", ["/styles.css"]);
      expect(result).toContain("/images/bg.jpg");
      expect(result).toContain("/fonts/Lato.ttf");
    });
  });

  // ---- R ----

  describe("R file scanning", () => {
    test("discovers paths from quoted strings", async () => {
      setupFileContents({
        "/project/script.R":
          "df <- read.csv(\"data/input.csv\")\nsource('lib/helpers.R')\n",
      });
      setupFiles({
        "/project/script.R": "file",
        "/project/data/input.csv": "file",
        "/project/lib/helpers.R": "file",
      });

      const result = await findLinkedResources("/project", ["/script.R"]);
      expect(result).toContain("/data/input.csv");
      expect(result).toContain("/lib/helpers.R");
    });

    test("ignores paths in comments at start of line", async () => {
      setupFileContents({
        "/project/script.R":
          '# old: read.csv("data/skip.csv")\ndf <- read.csv("data/keep.csv")\n',
      });
      setupFiles({
        "/project/script.R": "file",
        "/project/data/skip.csv": "file",
        "/project/data/keep.csv": "file",
      });

      const result = await findLinkedResources("/project", ["/script.R"]);
      expect(result).toContain("/data/keep.csv");
      expect(result).not.toContain("/data/skip.csv");
    });

    test("ignores paths in trailing comments", async () => {
      setupFileContents({
        "/project/script.R":
          'df <- read.csv("data/keep.csv") # was "data/old.csv"\n',
      });
      setupFiles({
        "/project/script.R": "file",
        "/project/data/keep.csv": "file",
        "/project/data/old.csv": "file",
      });

      const result = await findLinkedResources("/project", ["/script.R"]);
      expect(result).toContain("/data/keep.csv");
      expect(result).not.toContain("/data/old.csv");
    });
  });

  // ---- Code chunks in .qmd/.rmd ----

  describe("code chunk scanning", () => {
    test("discovers data files read in an {r} chunk", async () => {
      setupFileContents({
        "/project/report.qmd":
          '---\ntitle: Report\n---\n\n```{r}\nlibrary(readr)\npenguins <- read_csv("data/penguins.csv")\n```\n',
      });
      setupFiles({
        "/project/report.qmd": "file",
        "/project/data/penguins.csv": "file",
      });

      const result = await findLinkedResources("/project", ["/report.qmd"]);
      expect(result).toContain("/data/penguins.csv");
    });

    test("discovers data files read in a {python} chunk", async () => {
      setupFileContents({
        "/project/report.qmd":
          '```{python}\nimport pandas as pd\ndf = pd.read_csv("data/x.csv")\n```\n',
      });
      setupFiles({
        "/project/report.qmd": "file",
        "/project/data/x.csv": "file",
      });

      const result = await findLinkedResources("/project", ["/report.qmd"]);
      expect(result).toContain("/data/x.csv");
    });

    test("discovers files in .rmd chunks with labels and options", async () => {
      setupFileContents({
        "/project/report.rmd":
          "```{r load-data, echo=FALSE, message=FALSE}\nd <- read.csv('data/input.csv')\n```\n",
      });
      setupFiles({
        "/project/report.rmd": "file",
        "/project/data/input.csv": "file",
      });

      const result = await findLinkedResources("/project", ["/report.rmd"]);
      expect(result).toContain("/data/input.csv");
    });

    test("discovers files in plain ```r and {ojs} chunks", async () => {
      setupFileContents({
        "/project/report.qmd":
          '```r\nd <- read.csv("data/plain.csv")\n```\n\n```{ojs}\ndata = FileAttachment("data/ojs.json")\n```\n',
      });
      setupFiles({
        "/project/report.qmd": "file",
        "/project/data/plain.csv": "file",
        "/project/data/ojs.json": "file",
      });

      const result = await findLinkedResources("/project", ["/report.qmd"]);
      expect(result).toContain("/data/plain.csv");
      expect(result).toContain("/data/ojs.json");
    });

    test("discovers paths containing spaces", async () => {
      setupFileContents({
        "/project/report.qmd":
          '```{r}\nd <- read.csv("my data/annual report.csv")\n```\n',
      });
      setupFiles({
        "/project/report.qmd": "file",
        "/project/my data/annual report.csv": "file",
      });

      const result = await findLinkedResources("/project", ["/report.qmd"]);
      expect(result).toContain("/my data/annual report.csv");
    });

    test("discovers files referenced from inline code", async () => {
      setupFileContents({
        "/project/report.rmd":
          'The data has `r nrow(read.csv("data/inline.csv"))` rows.\n',
      });
      setupFiles({
        "/project/report.rmd": "file",
        "/project/data/inline.csv": "file",
      });

      const result = await findLinkedResources("/project", ["/report.rmd"]);
      expect(result).toContain("/data/inline.csv");
    });

    test("ignores paths in chunk comments", async () => {
      setupFileContents({
        "/project/report.qmd":
          '```{r}\n# was read.csv("data/old.csv")\nd <- read.csv("data/new.csv")\n```\n',
      });
      setupFiles({
        "/project/report.qmd": "file",
        "/project/data/old.csv": "file",
        "/project/data/new.csv": "file",
      });

      const result = await findLinkedResources("/project", ["/report.qmd"]);
      expect(result).toContain("/data/new.csv");
      expect(result).not.toContain("/data/old.csv");
    });

    test("excludes relative paths that do not exist on disk", async () => {
      setupFileContents({
        "/project/report.qmd":
          '```{r}\nd <- read.csv("data/missing.csv")\nlibrary(dplyr)\n```\n',
      });
      setupFiles({
        "/project/report.qmd": "file",
        // data/missing.csv intentionally absent
      });

      const result = await findLinkedResources("/project", ["/report.qmd"]);
      expect(result).toEqual([]);
    });

    test("excludes paths that escape the project directory", async () => {
      setupFileContents({
        "/project/report.qmd":
          '```{r}\nsecret <- read.csv("../secrets/private.csv")\nd <- read.csv("data/ok.csv")\n```\n',
      });
      setupFiles({
        "/project/report.qmd": "file",
        "/project/data/ok.csv": "file",
        "/secrets/private.csv": "file",
      });

      const result = await findLinkedResources("/project", ["/report.qmd"]);
      // the in-project file is still discovered, proving scanning ran
      expect(result).toEqual(["/data/ok.csv"]);
    });

    test("does not scan chunk contents of plain .md files", async () => {
      setupFileContents({
        "/project/README.md":
          '```{r}\nd <- read.csv("data/example.csv")\n```\n\n![](images/logo.png)\n',
      });
      setupFiles({
        "/project/README.md": "file",
        "/project/data/example.csv": "file",
        "/project/images/logo.png": "file",
      });

      const result = await findLinkedResources("/project", ["/README.md"]);
      // markdown scanning still works
      expect(result).toContain("/images/logo.png");
      // but code in a non-executed document is illustration, not a reference
      expect(result).not.toContain("/data/example.csv");
    });

    test("ignores example chunks wrapped in a longer verbatim fence", async () => {
      setupFileContents({
        "/project/report.qmd":
          '````\n```{r}\nread.csv("data/example.csv")\n```\n````\n\n```{r}\nread.csv("data/real.csv")\n```\n',
      });
      setupFiles({
        "/project/report.qmd": "file",
        "/project/data/example.csv": "file",
        "/project/data/real.csv": "file",
      });

      const result = await findLinkedResources("/project", ["/report.qmd"]);
      expect(result).toEqual(["/data/real.csv"]);
    });

    test("scans a chunk left unclosed at end of file", async () => {
      setupFileContents({
        "/project/report.qmd": '```{r}\nd <- read.csv("data/tail.csv")\n',
      });
      setupFiles({
        "/project/report.qmd": "file",
        "/project/data/tail.csv": "file",
      });

      const result = await findLinkedResources("/project", ["/report.qmd"]);
      expect(result).toContain("/data/tail.csv");
    });

    test("recursively scans R scripts sourced from a chunk", async () => {
      setupFileContents({
        "/project/report.qmd": '```{r}\nsource("helpers.R")\n```\n',
        "/project/helpers.R": 'd <- read.csv("data/nested.csv")\n',
      });
      setupFiles({
        "/project/report.qmd": "file",
        "/project/helpers.R": "file",
        "/project/data/nested.csv": "file",
      });

      const result = await findLinkedResources("/project", ["/report.qmd"]);
      expect(result).toContain("/helpers.R");
      expect(result).toContain("/data/nested.csv");
    });

    test("does not add directories referenced in chunks", async () => {
      setupFileContents({
        "/project/report.qmd": '```{r}\nfs::dir_ls("data")\n```\n',
      });
      setupFiles({
        "/project/report.qmd": "file",
        "/project/data": "directory",
      });

      const result = await findLinkedResources("/project", ["/report.qmd"]);
      expect(result).toEqual([]);
    });

    test("does not duplicate files already in the input files list", async () => {
      setupFileContents({
        "/project/report.qmd":
          '```{r}\nread.csv("data/a.csv")\nread.csv("data/b.csv")\n```\n',
      });
      setupFiles({
        "/project/report.qmd": "file",
        "/project/data/a.csv": "file",
        "/project/data/b.csv": "file",
      });

      const result = await findLinkedResources("/project", [
        "/report.qmd",
        "/data/a.csv",
      ]);
      expect(result).toEqual(["/data/b.csv"]);
    });
  });

  // ---- URL filtering ----

  describe("URL filtering", () => {
    test("excludes web URLs", async () => {
      setupFileContents({
        "/project/doc.qmd":
          "![](https://example.com/logo.png)\n![](images/local.png)\n",
      });
      setupFiles({
        "/project/doc.qmd": "file",
        "/project/images/local.png": "file",
      });

      const result = await findLinkedResources("/project", ["/doc.qmd"]);
      expect(result).toContain("/images/local.png");
      expect(result).not.toContain("https://example.com/logo.png");
    });

    test("excludes ftp and data URLs", async () => {
      setupFileContents({
        "/project/page.html":
          '<img src="ftp://server/file.png">\n<img src="data:image/png;base64,abc">\n<img src="local.png">\n',
      });
      setupFiles({
        "/project/page.html": "file",
        "/project/local.png": "file",
      });

      const result = await findLinkedResources("/project", ["/page.html"]);
      expect(result).toContain("/local.png");
      expect(result).toHaveLength(1);
    });
  });

  // ---- Recursive scanning ----

  describe("recursive scanning", () => {
    test("scans discovered HTML/CSS/R files recursively", async () => {
      setupFileContents({
        "/project/index.html":
          '<link href="styles/main.css" rel="stylesheet">\n',
        "/project/styles/main.css":
          'body { background: url("../images/bg.jpg"); }\n',
      });
      setupFiles({
        "/project/index.html": "file",
        "/project/styles/main.css": "file",
        "/project/images/bg.jpg": "file",
      });

      const result = await findLinkedResources("/project", ["/index.html"]);
      expect(result).toContain("/styles/main.css");
      expect(result).toContain("/images/bg.jpg");
    });

    test("prevents infinite loops from circular references", async () => {
      setupFileContents({
        "/project/a.html": '<link href="b.html" rel="alternate">\n',
        "/project/b.html": '<link href="a.html" rel="alternate">\n',
      });
      setupFiles({
        "/project/a.html": "file",
        "/project/b.html": "file",
      });

      // Should complete without hanging
      const result = await findLinkedResources("/project", ["/a.html"]);
      expect(result).toContain("/b.html");
    });
  });

  // ---- Non-existent paths ----

  describe("non-existent path filtering", () => {
    test("silently excludes paths that do not exist on disk", async () => {
      setupFileContents({
        "/project/doc.qmd": "![](images/exists.png)\n![](images/missing.png)\n",
      });
      setupFiles({
        "/project/doc.qmd": "file",
        "/project/images/exists.png": "file",
        // images/missing.png intentionally absent
      });

      const result = await findLinkedResources("/project", ["/doc.qmd"]);
      expect(result).toContain("/images/exists.png");
      expect(result).not.toContain("/images/missing.png");
    });
  });

  // ---- Deduplication and nested directory skip ----

  describe("deduplication", () => {
    test("does not add resources already in the input files list", async () => {
      setupFileContents({
        "/project/doc.qmd": "![](logo.png)\n![](other.png)\n",
      });
      setupFiles({
        "/project/doc.qmd": "file",
        "/project/logo.png": "file",
        "/project/other.png": "file",
      });

      const result = await findLinkedResources("/project", [
        "/doc.qmd",
        "/logo.png",
      ]);
      // other.png should be discovered (proves scanning works)
      expect(result).toContain("/other.png");
      // logo.png should be filtered out (already in input)
      expect(result).not.toContain("/logo.png");
    });

    test("skips resources nested under already-included directories", async () => {
      setupFileContents({
        "/project/index.html":
          '<link href="styles/custom.css" rel="stylesheet">\n<img src="logo.png">\n',
      });
      setupFiles({
        "/project/index.html": "file",
        "/project/styles/custom.css": "file",
        "/project/logo.png": "file",
      });

      const result = await findLinkedResources("/project", [
        "/index.html",
        "/styles",
      ]);
      // logo.png should be discovered (proves scanning works)
      expect(result).toContain("/logo.png");
      // styles/custom.css should be filtered (nested under /styles)
      expect(result).not.toContain("/styles/custom.css");
    });

    test("deduplicates resources found from multiple source files", async () => {
      setupFileContents({
        "/project/a.qmd": "![](shared/logo.png)\n",
        "/project/b.qmd": "![](shared/logo.png)\n",
      });
      setupFiles({
        "/project/a.qmd": "file",
        "/project/b.qmd": "file",
        "/project/shared/logo.png": "file",
      });

      const result = await findLinkedResources("/project", [
        "/a.qmd",
        "/b.qmd",
      ]);
      const logoEntries = result.filter((f) => f === "/shared/logo.png");
      expect(logoEntries).toHaveLength(1);
    });
  });

  // ---- Path resolution ----

  describe("path resolution", () => {
    test("resolves leading-/ paths relative to baseDir", async () => {
      setupFileContents({
        "/project/sub/doc.qmd": "![](/images/logo.png)\n",
      });
      setupFiles({
        "/project/sub/doc.qmd": "file",
        "/project/images/logo.png": "file",
      });

      const result = await findLinkedResources("/project", ["/sub/doc.qmd"]);
      expect(result).toContain("/images/logo.png");
    });

    test("resolves relative paths from containing file directory", async () => {
      setupFileContents({
        "/project/docs/guide.qmd": "![](../images/photo.jpg)\n",
      });
      setupFiles({
        "/project/docs/guide.qmd": "file",
        "/project/images/photo.jpg": "file",
      });

      const result = await findLinkedResources("/project", ["/docs/guide.qmd"]);
      expect(result).toContain("/images/photo.jpg");
    });
  });

  // ---- Unsupported file types ----

  describe("unsupported file types", () => {
    test("skips files with unsupported extensions", async () => {
      setupFileContents({});
      setupFiles({
        "/project/data.json": "file",
      });

      const result = await findLinkedResources("/project", ["/data.json"]);
      expect(result).toEqual([]);
    });
  });

  // ---- Empty inputs ----

  describe("edge cases", () => {
    test("returns empty array for empty files list", async () => {
      const result = await findLinkedResources("/project", []);
      expect(result).toEqual([]);
    });

    test("returns empty array when files have no references", async () => {
      setupFileContents({
        "/project/doc.qmd": "# Just some text\n\nNo images here.\n",
      });
      setupFiles({
        "/project/doc.qmd": "file",
      });

      const result = await findLinkedResources("/project", ["/doc.qmd"]);
      expect(result).toEqual([]);
    });
  });
});

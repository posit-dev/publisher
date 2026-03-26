// Copyright (C) 2026 by Posit Software, PBC.

import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as zlib from "zlib";
import { extract as tarExtract, Headers } from "tar-stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBundle } from "./bundler";
import { newManifest } from "./manifest";
import { Manifest } from "./types";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bundler-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeFile(relativePath: string, content = "test"): void {
  const fullPath = path.join(tmpDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

type TarEntry = { data: Buffer; header: Headers };

function extractTarEntries(bundle: Buffer): Promise<Map<string, TarEntry>> {
  return new Promise((resolve, reject) => {
    const entries = new Map<string, TarEntry>();
    const extract = tarExtract();
    const gunzip = zlib.createGunzip();

    extract.on("entry", (header, stream, next) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => {
        entries.set(header.name, { data: Buffer.concat(chunks), header });
        next();
      });
      stream.resume();
    });

    extract.on("finish", () => resolve(entries));
    extract.on("error", reject);

    gunzip.pipe(extract);
    gunzip.end(bundle);
  });
}

describe("createBundle", () => {
  it("creates a bundle from a directory", async () => {
    makeFile("app.py", "import dash");
    makeFile("requirements.txt", "dash==2.0");

    const manifest = newManifest();
    manifest.metadata.appmode = "python-dash";

    const result = await createBundle({
      projectPath: tmpDir,
      manifest,
    });

    expect(result.fileCount).toBe(2);
    expect(result.totalSize).toBeGreaterThan(0);
    expect(result.bundle.length).toBeGreaterThan(0);

    // Manifest should have files populated
    expect(result.manifest.files["app.py"]).toBeDefined();
    expect(result.manifest.files["requirements.txt"]).toBeDefined();
    expect(result.manifest.files["app.py"]?.checksum).toMatch(/^[0-9a-f]+$/);
  });

  it("includes manifest.json in the tar archive", async () => {
    makeFile("app.py", "print('hello')");

    const result = await createBundle({
      projectPath: tmpDir,
      manifest: newManifest(),
    });

    const entries = await extractTarEntries(result.bundle);
    expect(entries.has("manifest.json")).toBe(true);

    const manifestContent = JSON.parse(
      entries.get("manifest.json")!.data.toString(),
    );
    expect(manifestContent.version).toBe(1);
    expect(manifestContent.files["app.py"]).toBeDefined();
  });

  it("includes project files in the tar archive", async () => {
    makeFile("app.py", "content");
    makeFile("subdir/helper.py", "helper");

    const result = await createBundle({
      projectPath: tmpDir,
      manifest: newManifest(),
    });

    const entries = await extractTarEntries(result.bundle);
    expect(entries.has("app.py")).toBe(true);
    expect(entries.has("subdir/helper.py")).toBe(true);
    expect(entries.get("app.py")!.data.toString()).toBe("content");
  });

  it("respects file patterns", async () => {
    makeFile("app.py", "python");
    makeFile("data.csv", "a,b,c");

    const result = await createBundle({
      projectPath: tmpDir,
      manifest: newManifest(),
      filePatterns: ["*.py"],
    });

    const entries = await extractTarEntries(result.bundle);
    expect(entries.has("app.py")).toBe(true);
    expect(entries.has("data.csv")).toBe(false);
  });

  it("does not mutate the input manifest", async () => {
    makeFile("app.py");

    const original = newManifest();
    original.metadata.appmode = "python-dash";

    await createBundle({
      projectPath: tmpDir,
      manifest: original,
    });

    expect(Object.keys(original.files)).toHaveLength(0);
  });

  it("remaps staged renv.lock to bundle root", async () => {
    makeFile("app.R", "library(shiny)");
    makeFile(".posit/publish/deployments/renv.lock", '{"R":{}}');

    const result = await createBundle({
      projectPath: tmpDir,
      manifest: newManifest(),
    });

    const entries = await extractTarEntries(result.bundle);
    // Should appear as renv.lock at root, not at the staged path
    expect(entries.has("renv.lock")).toBe(true);
    expect(entries.has(".posit/publish/deployments/renv.lock")).toBe(false);

    // Should be in manifest as renv.lock
    expect(result.manifest.files["renv.lock"]).toBeDefined();
  });

  it("excludes standard exclusions", async () => {
    makeFile("app.py");
    makeFile(".git/config");
    makeFile("__pycache__/module.pyc");
    makeFile("node_modules/pkg/index.js");

    const result = await createBundle({
      projectPath: tmpDir,
      manifest: newManifest(),
    });

    const entries = await extractTarEntries(result.bundle);
    expect(entries.has("app.py")).toBe(true);
    expect(entries.has(".git/config")).toBe(false);
    expect(entries.has("__pycache__/module.pyc")).toBe(false);
    expect(entries.has("node_modules/pkg/index.js")).toBe(false);
  });

  it("creates a bundle from a single file path", async () => {
    makeFile("app.py", "main app");
    makeFile("other.py", "other file");

    const result = await createBundle({
      projectPath: path.join(tmpDir, "app.py"),
      manifest: newManifest(),
    });

    expect(result.manifest.files["app.py"]).toBeDefined();
  });

  it("force-includes entrypoint file even if excluded by patterns", async () => {
    makeFile("app.py", "main");
    makeFile("data.csv", "data");

    const result = await createBundle({
      projectPath: path.join(tmpDir, "app.py"),
      manifest: newManifest(),
      filePatterns: ["*.csv"], // Only include CSVs
    });

    // app.py should still be included because it's the entrypoint
    expect(result.manifest.files["app.py"]).toBeDefined();
    expect(result.manifest.files["data.csv"]).toBeDefined();
  });

  it("produces valid gzipped tar", async () => {
    makeFile("test.txt", "hello world");

    const result = await createBundle({
      projectPath: tmpDir,
      manifest: newManifest(),
    });

    // Should decompress without error
    const decompressed = zlib.gunzipSync(result.bundle);
    expect(decompressed.length).toBeGreaterThan(0);
  });

  it("preserves manifest metadata through bundling", async () => {
    makeFile("app.py");

    const manifest: Manifest = {
      version: 1,
      metadata: {
        appmode: "python-dash",
        entrypoint: "app.py",
      },
      python: {
        version: "3.11.3",
        package_manager: {
          name: "pip",
          package_file: "requirements.txt",
        },
      },
      packages: {},
      files: {},
    };

    const result = await createBundle({
      projectPath: tmpDir,
      manifest,
    });

    expect(result.manifest.metadata.appmode).toBe("python-dash");
    expect(result.manifest.metadata.entrypoint).toBe("app.py");
    expect(result.manifest.python?.version).toBe("3.11.3");
  });

  it("produces correct MD5 checksums in manifest", async () => {
    const content = "known content for checksum";
    makeFile("app.py", content);

    const expectedMd5 = crypto.createHash("md5").update(content).digest("hex");

    const result = await createBundle({
      projectPath: tmpDir,
      manifest: newManifest(),
    });

    expect(result.manifest.files["app.py"]?.checksum).toBe(expectedMd5);
  });

  // Windows doesn't support Unix file permissions — chmod is a no-op
  // and all files get mode 0o666, so this test only makes sense on Unix.
  it.skipIf(process.platform === "win32")(
    "preserves file modes in tar headers",
    async () => {
      makeFile("app.py", "print('hello')");
      makeFile("run.sh", "#!/bin/bash\npython app.py");
      fs.chmodSync(path.join(tmpDir, "run.sh"), 0o755);

      const result = await createBundle({
        projectPath: tmpDir,
        manifest: newManifest(),
      });

      const entries = await extractTarEntries(result.bundle);
      const appHeader = entries.get("app.py")!.header;
      const shHeader = entries.get("run.sh")!.header;

      // app.py should have default file mode (typically 0o644)
      expect(appHeader.mode).toBe(0o644);
      // run.sh should preserve the executable mode
      expect(shHeader.mode).toBe(0o755);
    },
  );
});

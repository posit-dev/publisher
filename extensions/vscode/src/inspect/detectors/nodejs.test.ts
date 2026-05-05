// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { ContentType } from "src/api/types/configurations";
import { NodejsAppDetector } from "./nodejs";

const detector = new NodejsAppDetector();

let baseDir: string;

beforeEach(() => {
  baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "nodejs-detector-"));
});

afterEach(() => {
  fs.rmSync(baseDir, { recursive: true, force: true });
});

function writeFile(rel: string, contents = ""): void {
  const abs = path.join(baseDir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contents);
}

function writePackageJson(json: unknown): void {
  writeFile("package.json", JSON.stringify(json));
}

describe("NodejsAppDetector", () => {
  test("returns [] when there is no package.json and no caller entrypoint", async () => {
    const configs = await detector.inferType(baseDir);
    expect(configs).toEqual([]);
  });

  describe("caller-provided entrypoint", () => {
    test("emits config when file exists and extension is valid", async () => {
      writeFile("server.js", "");
      const configs = await detector.inferType(baseDir, "server.js");
      expect(configs).toEqual([
        { type: ContentType.NODEJS, entrypoint: "server.js" },
      ]);
    });

    test("normalizes ./prefix and subdir paths to forward slashes", async () => {
      writeFile("src/app.ts", "");
      const configs = await detector.inferType(baseDir, "./src/app.ts");
      expect(configs).toEqual([
        { type: ContentType.NODEJS, entrypoint: "src/app.ts" },
      ]);
    });

    test("returns [] when extension is not a valid Node.js extension", async () => {
      writeFile("app.py", "");
      const configs = await detector.inferType(baseDir, "app.py");
      expect(configs).toEqual([]);
    });

    test("returns [] when file does not exist", async () => {
      const configs = await detector.inferType(baseDir, "missing.js");
      expect(configs).toEqual([]);
    });

    test("accepts every valid extension", async () => {
      for (const ext of [".js", ".mjs", ".cjs", ".ts", ".mts", ".cts"]) {
        writeFile(`entry${ext}`, "");
        const configs = await detector.inferType(baseDir, `entry${ext}`);
        expect(configs).toEqual([
          { type: ContentType.NODEJS, entrypoint: `entry${ext}` },
        ]);
      }
    });
  });

  describe("package.json main field", () => {
    test("emits config when main resolves to an existing file", async () => {
      writePackageJson({ main: "server.js" });
      writeFile("server.js", "");
      const configs = await detector.inferType(baseDir);
      expect(configs).toEqual([
        { type: ContentType.NODEJS, entrypoint: "server.js" },
      ]);
    });

    test("preserves subdir paths from main", async () => {
      writePackageJson({ main: "src/index.js" });
      writeFile("src/index.js", "");
      const configs = await detector.inferType(baseDir);
      expect(configs).toEqual([
        { type: ContentType.NODEJS, entrypoint: "src/index.js" },
      ]);
    });

    test("normalizes ./ prefix in main", async () => {
      writePackageJson({ main: "./dist/server.js" });
      writeFile("dist/server.js", "");
      const configs = await detector.inferType(baseDir);
      expect(configs).toEqual([
        { type: ContentType.NODEJS, entrypoint: "dist/server.js" },
      ]);
    });

    test("ignores main when the referenced file does not exist", async () => {
      writePackageJson({ main: "missing.js" });
      const configs = await detector.inferType(baseDir);
      expect(configs).toEqual([]);
    });

    test("ignores empty main string", async () => {
      writePackageJson({ main: "" });
      const configs = await detector.inferType(baseDir);
      expect(configs).toEqual([]);
    });

    test("ignores non-string main", async () => {
      writePackageJson({ main: 42 });
      const configs = await detector.inferType(baseDir);
      expect(configs).toEqual([]);
    });
  });

  describe("malformed package.json", () => {
    test("returns [] silently and does NOT fall through to conventional files", async () => {
      writeFile("package.json", "{ this is not json");
      writeFile("server.js", ""); // present but should NOT be picked up.
      const configs = await detector.inferType(baseDir);
      expect(configs).toEqual([]);
    });
  });
});

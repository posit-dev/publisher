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

    test("caller-provided entrypoint wins when package.json main points elsewhere", async () => {
      writePackageJson({ main: "other.js" });
      writeFile("other.js", "");
      writeFile("server.js", "");
      const configs = await detector.inferType(baseDir, "server.js");
      expect(configs).toEqual([
        { type: ContentType.NODEJS, entrypoint: "server.js" },
      ]);
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

  describe("package.json scripts.start", () => {
    test("emits config for simple node <file> command", async () => {
      writePackageJson({ scripts: { start: "node app.js" } });
      writeFile("app.js", "");
      const configs = await detector.inferType(baseDir);
      expect(configs).toEqual([
        { type: ContentType.NODEJS, entrypoint: "app.js" },
      ]);
    });

    test("ignores flags between node and the file", async () => {
      writePackageJson({
        scripts: { start: "node --inspect=9229 -r dotenv/config app.js" },
      });
      writeFile("app.js", "");
      const configs = await detector.inferType(baseDir);
      expect(configs).toEqual([
        { type: ContentType.NODEJS, entrypoint: "app.js" },
      ]);
    });

    test("matches node even when env vars are prepended", async () => {
      writePackageJson({
        scripts: { start: "NODE_ENV=production node app.js" },
      });
      writeFile("app.js", "");
      const configs = await detector.inferType(baseDir);
      expect(configs).toEqual([
        { type: ContentType.NODEJS, entrypoint: "app.js" },
      ]);
    });

    test("falls through when start command uses nodemon", async () => {
      writePackageJson({ scripts: { start: "nodemon app.js" } });
      // No fallback files present — should return [] because nodemon isn't
      // a literal `node` invocation and there is nothing for the fallback to find.
      const configs = await detector.inferType(baseDir);
      expect(configs).toEqual([]);
    });

    test("falls through when start command uses npx tsx", async () => {
      writePackageJson({ scripts: { start: "npx tsx app.ts" } });
      // No fallback files present — should return [] because npx tsx isn't
      // a literal `node` invocation and there is nothing for the fallback to find.
      const configs = await detector.inferType(baseDir);
      expect(configs).toEqual([]);
    });

    test("falls through when start is just `node` with no file", async () => {
      writePackageJson({ scripts: { start: "node" } });
      const configs = await detector.inferType(baseDir);
      expect(configs).toEqual([]);
    });

    test("falls through when first arg has unsupported extension", async () => {
      writePackageJson({ scripts: { start: "node app.txt" } });
      writeFile("app.txt", "");
      const configs = await detector.inferType(baseDir);
      expect(configs).toEqual([]);
    });

    test("ignores scripts.start when referenced file does not exist", async () => {
      writePackageJson({ scripts: { start: "node missing.js" } });
      const configs = await detector.inferType(baseDir);
      expect(configs).toEqual([]);
    });

    test("prefers main over scripts.start when both resolve", async () => {
      writePackageJson({
        main: "server.js",
        scripts: { start: "node other.js" },
      });
      writeFile("server.js", "");
      writeFile("other.js", "");
      const configs = await detector.inferType(baseDir);
      expect(configs).toEqual([
        { type: ContentType.NODEJS, entrypoint: "server.js" },
      ]);
    });

    test("falls through from missing main to scripts.start", async () => {
      writePackageJson({
        main: "missing.js",
        scripts: { start: "node app.js" },
      });
      writeFile("app.js", "");
      const configs = await detector.inferType(baseDir);
      expect(configs).toEqual([
        { type: ContentType.NODEJS, entrypoint: "app.js" },
      ]);
    });

    test("matches node within ts-node (mirrors Connect parity)", async () => {
      writePackageJson({ scripts: { start: "ts-node app.ts" } });
      writeFile("app.ts", "");
      const configs = await detector.inferType(baseDir);
      // The \bnode\s+ regex finds the boundary between '-' and 'n', so this
      // emits app.ts. Mirrors run_app.js exactly. If Connect's behavior changes,
      // this test should fail loudly so the detector can be re-aligned.
      expect(configs).toEqual([
        { type: ContentType.NODEJS, entrypoint: "app.ts" },
      ]);
    });
  });

  describe("conventional file fallback", () => {
    test("emits server.js when no main or scripts.start", async () => {
      writePackageJson({});
      writeFile("server.js", "");
      const configs = await detector.inferType(baseDir);
      expect(configs).toEqual([
        { type: ContentType.NODEJS, entrypoint: "server.js" },
      ]);
    });

    test("prefers server.js over app.js", async () => {
      writePackageJson({});
      writeFile("server.js", "");
      writeFile("app.js", "");
      const configs = await detector.inferType(baseDir);
      expect(configs[0]?.entrypoint).toBe("server.js");
    });

    test("prefers app.js over index.js", async () => {
      writePackageJson({});
      writeFile("app.js", "");
      writeFile("index.js", "");
      const configs = await detector.inferType(baseDir);
      expect(configs[0]?.entrypoint).toBe("app.js");
    });

    test("prefers index.js over .ts variants", async () => {
      writePackageJson({});
      writeFile("index.js", "");
      writeFile("server.ts", "");
      const configs = await detector.inferType(baseDir);
      expect(configs[0]?.entrypoint).toBe("index.js");
    });

    test("prefers server.ts over app.ts", async () => {
      writePackageJson({});
      writeFile("server.ts", "");
      writeFile("app.ts", "");
      const configs = await detector.inferType(baseDir);
      expect(configs[0]?.entrypoint).toBe("server.ts");
    });

    test("prefers app.ts over index.ts", async () => {
      writePackageJson({});
      writeFile("app.ts", "");
      writeFile("index.ts", "");
      const configs = await detector.inferType(baseDir);
      expect(configs[0]?.entrypoint).toBe("app.ts");
    });

    test("emits index.ts when it is the only fallback present", async () => {
      writePackageJson({});
      writeFile("index.ts", "");
      const configs = await detector.inferType(baseDir);
      expect(configs).toEqual([
        { type: ContentType.NODEJS, entrypoint: "index.ts" },
      ]);
    });

    test("returns [] when package.json exists but no conventional file is present", async () => {
      writePackageJson({});
      const configs = await detector.inferType(baseDir);
      expect(configs).toEqual([]);
    });

    test("works when baseDir contains spaces", async () => {
      fs.rmSync(baseDir, { recursive: true, force: true });
      baseDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "nodejs detector with spaces "),
      );
      writePackageJson({});
      writeFile("index.js", "");
      const configs = await detector.inferType(baseDir);
      expect(configs).toEqual([
        { type: ContentType.NODEJS, entrypoint: "index.js" },
      ]);
    });

    test("falls through from non-node scripts.start to conventional fallback", async () => {
      writePackageJson({ scripts: { start: "nodemon app.js" } });
      writeFile("server.js", "");
      const configs = await detector.inferType(baseDir);
      expect(configs).toEqual([
        { type: ContentType.NODEJS, entrypoint: "server.js" },
      ]);
    });
  });
});

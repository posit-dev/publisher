// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
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
});

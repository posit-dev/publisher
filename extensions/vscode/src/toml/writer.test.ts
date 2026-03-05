// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeConfigToFile } from "./writer";
import { ConfigurationDetails, ContentType } from "../api/types/configurations";
import { ProductType } from "../api/types/contentRecords";
import { ConfigurationLoadError } from "./errors";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-writer-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function configPath(name: string): string {
  return path.join(tmpDir, ".posit", "publish", `${name}.toml`);
}

function makeConfig(
  overrides: Partial<ConfigurationDetails> = {},
): ConfigurationDetails {
  return {
    $schema:
      "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json",
    type: ContentType.PYTHON_DASH,
    entrypoint: "app.py",
    productType: ProductType.CONNECT,
    validate: true,
    files: ["app.py", "requirements.txt"],
    python: {
      version: "3.11.3",
      packageFile: "requirements.txt",
      packageManager: "pip",
    },
    ...overrides,
  };
}

describe("writeConfigToFile", () => {
  it("writes a valid config and returns Configuration", async () => {
    const fp = configPath("myapp");
    const cfg = await writeConfigToFile(fp, tmpDir, makeConfig());

    expect(cfg.configurationName).toBe("myapp");
    expect(cfg.configurationPath).toBe(fp);
    expect(cfg.projectDir).toBe(tmpDir);
    expect(cfg.configuration.type).toBe(ContentType.PYTHON_DASH);

    // Verify the file was created
    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain('type = "python-dash"');
    expect(content).toContain('entrypoint = "app.py"');
  });

  it("creates directory if it does not exist", async () => {
    const fp = configPath("newdir-test");

    await writeConfigToFile(fp, tmpDir, makeConfig());

    expect(fs.existsSync(fp)).toBe(true);
  });

  it("writes TOML with snake_case keys", async () => {
    const fp = configPath("snake");
    await writeConfigToFile(
      fp,
      tmpDir,
      makeConfig({
        python: {
          version: "3.11.3",
          packageFile: "requirements.txt",
          packageManager: "pip",
          requiresPython: ">=3.11",
        },
      }),
    );

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("package_file");
    expect(content).toContain("package_manager");
    expect(content).toContain("requires_python");
    // Should not contain camelCase
    expect(content).not.toContain("packageFile");
    expect(content).not.toContain("packageManager");
    expect(content).not.toContain("requiresPython");
  });

  it("writes leading comments", async () => {
    const fp = configPath("comments");
    const cfg = makeConfig({
      comments: [" This is a comment", " Another line"],
    });

    await writeConfigToFile(fp, tmpDir, cfg);

    const content = fs.readFileSync(fp, "utf-8");
    expect(content.startsWith("# This is a comment\n# Another line\n")).toBe(
      true,
    );
  });

  it("does not mutate the input config", async () => {
    const fp = configPath("no-mutate");
    const original = makeConfig({
      comments: [" comment"],
      alternatives: [makeConfig()],
    });
    const originalType = original.type;
    const originalComments = [...original.comments!];

    await writeConfigToFile(fp, tmpDir, original);

    expect(original.type).toBe(originalType);
    expect(original.comments).toEqual(originalComments);
    expect(original.alternatives).toHaveLength(1);
  });

  it("strips empty strings from optional fields", async () => {
    const fp = configPath("strip-empty");
    await writeConfigToFile(
      fp,
      tmpDir,
      makeConfig({
        title: "",
        description: "",
      }),
    );

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).not.toContain("title");
    expect(content).not.toContain("description");
  });

  it("applies Connect Cloud compliance", async () => {
    const fp = configPath("cloud");
    await writeConfigToFile(
      fp,
      tmpDir,
      makeConfig({
        productType: ProductType.CONNECT_CLOUD,
        python: {
          version: "3.11.3",
          packageFile: "requirements.txt",
          packageManager: "pip",
          requiresPython: ">=3.11",
        },
      }),
    );

    const content = fs.readFileSync(fp, "utf-8");
    // Version truncated to X.Y
    expect(content).toContain('version = "3.11"');
    // Disallowed fields stripped
    expect(content).not.toContain("package_file");
    expect(content).not.toContain("package_manager");
    expect(content).not.toContain("requires_python");
  });

  it("handles type unknown by substituting for validation", async () => {
    const fp = configPath("unknown-type");
    const cfg = await writeConfigToFile(
      fp,
      tmpDir,
      makeConfig({ type: ContentType.UNKNOWN }),
    );

    // The returned config preserves the original type
    expect(cfg.configuration.type).toBe(ContentType.UNKNOWN);

    // The file contains "unknown"
    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain('type = "unknown"');
  });

  it("preserves environment keys as-is", async () => {
    const fp = configPath("env");
    await writeConfigToFile(
      fp,
      tmpDir,
      makeConfig({
        environment: {
          MY_API_KEY: "value",
          DATABASE_URL: "postgres://localhost/db",
        },
      }),
    );

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("MY_API_KEY");
    expect(content).toContain("DATABASE_URL");
  });

  it("throws ConfigurationLoadError for invalid config", async () => {
    const fp = configPath("invalid");
    // Deliberately incomplete config to test schema validation —
    // assertion needed because we're intentionally violating the type contract
    const badConfig = {
      $schema:
        "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json",
      productType: ProductType.CONNECT,
      validate: true,
    } as ConfigurationDetails;

    try {
      await writeConfigToFile(fp, tmpDir, badConfig);
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationLoadError);
      if (error instanceof ConfigurationLoadError) {
        expect(error.configurationError.error.code).toBe("tomlValidationError");
      }
    }
  });

  it("file ends with newline", async () => {
    const fp = configPath("newline");
    await writeConfigToFile(fp, tmpDir, makeConfig());

    const content = fs.readFileSync(fp, "utf-8");
    expect(content.endsWith("\n")).toBe(true);
  });

  it("strips alternatives from written file", async () => {
    const fp = configPath("no-alternatives");
    await writeConfigToFile(
      fp,
      tmpDir,
      makeConfig({
        alternatives: [makeConfig({ type: ContentType.HTML })],
      }),
    );

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).not.toContain("alternatives");
  });

  it("strips comments field from TOML body", async () => {
    const fp = configPath("no-comments-field");
    await writeConfigToFile(fp, tmpDir, makeConfig({ comments: [] }));

    const content = fs.readFileSync(fp, "utf-8");
    // "comments" should not appear as a TOML key
    expect(content).not.toMatch(/^comments\s*=/m);
  });
});

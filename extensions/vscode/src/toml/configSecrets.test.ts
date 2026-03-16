// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addSecret, removeSecret } from "./configSecrets";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-secrets-test-"));
  fs.mkdirSync(path.join(tmpDir, ".posit", "publish"), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeConfig(name: string, content: string): void {
  const configPath = path.join(tmpDir, ".posit", "publish", `${name}.toml`);
  fs.writeFileSync(configPath, content, "utf-8");
}

function readConfig(name: string): string {
  const configPath = path.join(tmpDir, ".posit", "publish", `${name}.toml`);
  return fs.readFileSync(configPath, "utf-8");
}

const baseToml = `"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "python-dash"
entrypoint = "app.py"

[python]
version = "3.11"
`;

const tomlWithSecrets = `"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "python-dash"
entrypoint = "app.py"
secrets = ["API_KEY", "DB_PASSWORD"]

[python]
version = "3.11"
`;

const tomlWithEnvironment = `"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "python-dash"
entrypoint = "app.py"

[python]
version = "3.11"

[environment]
MY_VAR = "value"
`;

describe("addSecret", () => {
  it("adds a secret to a config with no secrets", async () => {
    writeConfig("myapp", baseToml);

    await addSecret("myapp", "MY_SECRET", ".", tmpDir);

    const content = readConfig("myapp");
    expect(content).toContain("MY_SECRET");
  });

  it("appends to existing secrets", async () => {
    writeConfig("myapp", tomlWithSecrets);

    await addSecret("myapp", "NEW_SECRET", ".", tmpDir);

    const content = readConfig("myapp");
    expect(content).toContain("API_KEY");
    expect(content).toContain("DB_PASSWORD");
    expect(content).toContain("NEW_SECRET");
  });

  it("is a no-op when adding a duplicate secret", async () => {
    writeConfig("myapp", tomlWithSecrets);

    await addSecret("myapp", "API_KEY", ".", tmpDir);

    const content = readConfig("myapp");
    // Should still have exactly 2 secrets, not 3
    const matches = content.match(/API_KEY/g);
    expect(matches).toHaveLength(1);
  });

  it("throws when secret name conflicts with environment key", async () => {
    writeConfig("myapp", tomlWithEnvironment);

    await expect(addSecret("myapp", "MY_VAR", ".", tmpDir)).rejects.toThrow(
      "secret name already exists in environment",
    );
  });

  it("throws ENOENT for missing config file", async () => {
    await expect(
      addSecret("nonexistent", "SECRET", ".", tmpDir),
    ).rejects.toThrow(/ENOENT/);
  });

  it("preserves other config fields after adding", async () => {
    writeConfig("myapp", baseToml);

    await addSecret("myapp", "MY_SECRET", ".", tmpDir);

    const content = readConfig("myapp");
    expect(content).toContain('type = "python-dash"');
    expect(content).toContain('entrypoint = "app.py"');
    expect(content).toContain("MY_SECRET");
  });
});

describe("removeSecret", () => {
  it("removes an existing secret", async () => {
    writeConfig("myapp", tomlWithSecrets);

    await removeSecret("myapp", "API_KEY", ".", tmpDir);

    const content = readConfig("myapp");
    expect(content).not.toContain("API_KEY");
    expect(content).toContain("DB_PASSWORD");
  });

  it("is a no-op when removing a non-existent secret", async () => {
    writeConfig("myapp", tomlWithSecrets);

    await removeSecret("myapp", "DOES_NOT_EXIST", ".", tmpDir);

    const content = readConfig("myapp");
    expect(content).toContain("API_KEY");
    expect(content).toContain("DB_PASSWORD");
  });

  it("removes only the first matching secret", async () => {
    writeConfig("myapp", tomlWithSecrets);

    await removeSecret("myapp", "DB_PASSWORD", ".", tmpDir);

    const content = readConfig("myapp");
    expect(content).toContain("API_KEY");
    expect(content).not.toContain("DB_PASSWORD");
  });

  it("throws ENOENT for missing config file", async () => {
    await expect(
      removeSecret("nonexistent", "SECRET", ".", tmpDir),
    ).rejects.toThrow(/ENOENT/);
  });

  it("preserves other config fields after removing", async () => {
    writeConfig("myapp", tomlWithSecrets);

    await removeSecret("myapp", "API_KEY", ".", tmpDir);

    const content = readConfig("myapp");
    expect(content).toContain('type = "python-dash"');
    expect(content).toContain('entrypoint = "app.py"');
    expect(content).not.toContain("API_KEY");
  });
});

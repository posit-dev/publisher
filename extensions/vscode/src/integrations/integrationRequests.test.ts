// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  listIntegrationRequests,
  addIntegrationRequest,
  removeIntegrationRequest,
} from "./integrationRequests";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "integration-requests-test-"));
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

const tomlWithIntegration = `"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "python-dash"
entrypoint = "app.py"

[python]
version = "3.11"

[[integration_requests]]
guid = "11111111-1111-1111-1111-111111111111"
`;

describe("listIntegrationRequests", () => {
  it("returns empty array when config has no integration requests", async () => {
    writeConfig("myapp", baseToml);
    const result = await listIntegrationRequests("myapp", ".", tmpDir);
    expect(result).toEqual([]);
  });

  it("returns integration requests from config", async () => {
    writeConfig("myapp", tomlWithIntegration);
    const result = await listIntegrationRequests("myapp", ".", tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0]!.guid).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("returns multiple integration requests", async () => {
    writeConfig(
      "myapp",
      `${baseToml}
[[integration_requests]]
guid = "aaaa"

[[integration_requests]]
guid = "bbbb"
`,
    );
    const result = await listIntegrationRequests("myapp", ".", tmpDir);
    expect(result).toHaveLength(2);
    expect(result[0]!.guid).toBe("aaaa");
    expect(result[1]!.guid).toBe("bbbb");
  });

  it("throws ENOENT for missing config file", async () => {
    await expect(
      listIntegrationRequests("nonexistent", ".", tmpDir),
    ).rejects.toThrow(/ENOENT/);
  });
});

describe("addIntegrationRequest", () => {
  it("adds a new integration request to a config with none", async () => {
    writeConfig("myapp", baseToml);

    await addIntegrationRequest("myapp", ".", tmpDir, {
      guid: "22222222-2222-2222-2222-222222222222",
    });

    const result = await listIntegrationRequests("myapp", ".", tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0]!.guid).toBe("22222222-2222-2222-2222-222222222222");
  });

  it("appends to existing integration requests", async () => {
    writeConfig("myapp", tomlWithIntegration);

    await addIntegrationRequest("myapp", ".", tmpDir, {
      guid: "22222222-2222-2222-2222-222222222222",
    });

    const result = await listIntegrationRequests("myapp", ".", tmpDir);
    expect(result).toHaveLength(2);
    expect(result[0]!.guid).toBe("11111111-1111-1111-1111-111111111111");
    expect(result[1]!.guid).toBe("22222222-2222-2222-2222-222222222222");
  });

  it("is a no-op when adding a duplicate integration request", async () => {
    writeConfig("myapp", tomlWithIntegration);

    await addIntegrationRequest("myapp", ".", tmpDir, {
      guid: "11111111-1111-1111-1111-111111111111",
    });

    const result = await listIntegrationRequests("myapp", ".", tmpDir);
    expect(result).toHaveLength(1);
  });

  it("throws ENOENT for missing config file", async () => {
    await expect(
      addIntegrationRequest("nonexistent", ".", tmpDir, { guid: "abc" }),
    ).rejects.toThrow(/ENOENT/);
  });

  it("preserves other config fields after adding", async () => {
    writeConfig("myapp", baseToml);

    await addIntegrationRequest("myapp", ".", tmpDir, {
      guid: "test-guid",
    });

    const content = readConfig("myapp");
    expect(content).toContain('type = "python-dash"');
    expect(content).toContain('entrypoint = "app.py"');
    expect(content).toContain("test-guid");
  });
});

describe("removeIntegrationRequest", () => {
  it("removes an existing integration request", async () => {
    writeConfig("myapp", tomlWithIntegration);

    await removeIntegrationRequest("myapp", ".", tmpDir, {
      guid: "11111111-1111-1111-1111-111111111111",
    });

    const result = await listIntegrationRequests("myapp", ".", tmpDir);
    expect(result).toEqual([]);
  });

  it("is a no-op when removing a non-existent integration request", async () => {
    writeConfig("myapp", tomlWithIntegration);

    await removeIntegrationRequest("myapp", ".", tmpDir, {
      guid: "does-not-exist",
    });

    const result = await listIntegrationRequests("myapp", ".", tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0]!.guid).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("removes only the matching request when multiple exist", async () => {
    writeConfig(
      "myapp",
      `${baseToml}
[[integration_requests]]
guid = "aaaa"

[[integration_requests]]
guid = "bbbb"

[[integration_requests]]
guid = "cccc"
`,
    );

    await removeIntegrationRequest("myapp", ".", tmpDir, { guid: "bbbb" });

    const result = await listIntegrationRequests("myapp", ".", tmpDir);
    expect(result).toHaveLength(2);
    expect(result[0]!.guid).toBe("aaaa");
    expect(result[1]!.guid).toBe("cccc");
  });

  it("throws ENOENT for missing config file", async () => {
    await expect(
      removeIntegrationRequest("nonexistent", ".", tmpDir, { guid: "abc" }),
    ).rejects.toThrow(/ENOENT/);
  });

  it("preserves other config fields after removing", async () => {
    writeConfig("myapp", tomlWithIntegration);

    await removeIntegrationRequest("myapp", ".", tmpDir, {
      guid: "11111111-1111-1111-1111-111111111111",
    });

    const content = readConfig("myapp");
    expect(content).toContain('type = "python-dash"');
    expect(content).toContain('entrypoint = "app.py"');
    expect(content).not.toContain("11111111");
  });
});

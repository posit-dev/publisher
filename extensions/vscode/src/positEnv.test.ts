// Copyright (C) 2026 by Posit Software, PBC.

import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./logging", () => ({
  logger: { debug: vi.fn(), info: vi.fn() },
}));

import {
  detectPositEnvironment,
  positEnvMarker,
  POSIT_ENV_MARKER_FILE,
} from "./positEnv";

describe("detectPositEnvironment", () => {
  const tmpDirs: string[] = [];
  afterEach(async () => {
    await Promise.all(
      tmpDirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })),
    );
  });

  async function makeEnvPath(receipt?: object): Promise<string> {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), "positenv-"));
    tmpDirs.push(base);
    // Mimic the store layout: <store>/<digest-hex>/<platform>
    const envPath = path.join(base, "abc123", "linux-amd64");
    await fs.mkdir(path.join(envPath, ".posit-env"), { recursive: true });
    if (receipt) {
      await fs.writeFile(
        path.join(envPath, ".posit-env", "receipt.json"),
        JSON.stringify(receipt),
      );
    }
    return envPath;
  }

  it("returns undefined outside a posit-env session", async () => {
    expect(await detectPositEnvironment({})).toBeUndefined();
    // Partial environments (no digest) don't count.
    expect(
      await detectPositEnvironment({ POSIT_ENV_NAME: "demo/app:prod" }),
    ).toBeUndefined();
  });

  it("reads the platform from the realization receipt", async () => {
    const envPath = await makeEnvPath({ platform: "linux-arm64" });
    const detected = await detectPositEnvironment({
      POSIT_ENV_NAME: "demo/app:prod",
      POSIT_ENV_DIGEST: "sha256:abc123",
      POSIT_ENV_PATH: envPath,
      POSIT_ENV_SERVER: "http://server:6464",
    });
    expect(detected).toEqual({
      ref: "demo/app:prod",
      digest: "sha256:abc123",
      envPath,
      platform: "linux-arm64",
      server: "http://server:6464",
    });
  });

  it("falls back to the store path's platform segment", async () => {
    const envPath = await makeEnvPath(); // no receipt
    const detected = await detectPositEnvironment({
      POSIT_ENV_NAME: "demo/app:prod",
      POSIT_ENV_DIGEST: "sha256:abc123",
      POSIT_ENV_PATH: envPath,
    });
    expect(detected?.platform).toBe("linux-amd64");
    expect(detected?.server).toBeUndefined();
    expect(detected?.contentImage).toBeUndefined();
  });

  it("carries the content image from Kubernetes launcher sessions", async () => {
    const envPath = await makeEnvPath();
    const detected = await detectPositEnvironment({
      POSIT_ENV_NAME: "demo/app:prod",
      POSIT_ENV_DIGEST: "sha256:abc123",
      POSIT_ENV_PATH: envPath,
      POSIT_ENV_CONTENT_IMAGE:
        "registry.localtest.me:5000/demo/app/connect-content:lock-abc123abc123",
    });
    expect(detected?.contentImage).toBe(
      "registry.localtest.me:5000/demo/app/connect-content:lock-abc123abc123",
    );
  });
});

describe("positEnvMarker", () => {
  it("emits the supervisor contract fields", () => {
    const marker = JSON.parse(
      positEnvMarker({
        ref: "demo/app:prod",
        digest: "sha256:abc123",
        envPath: "/posit/store/abc123/linux-amd64",
        platform: "linux-amd64",
        server: "http://server:6464",
      }).toString(),
    );
    expect(marker).toEqual({
      ref: "demo/app:prod",
      digest: "sha256:abc123",
      platform: "linux-amd64",
      server: "http://server:6464",
    });
    // The local realization path is session-specific — never shipped.
    expect(marker.envPath).toBeUndefined();
  });

  it("has the filename Connect's supervisor watches for", () => {
    expect(POSIT_ENV_MARKER_FILE).toBe("posit-env.json");
  });
});

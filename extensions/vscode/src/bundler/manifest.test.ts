// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, it } from "vitest";
import {
  newManifest,
  addFile,
  manifestToJSON,
  cloneManifest,
  getFilenames,
} from "./manifest";

describe("newManifest", () => {
  it("creates a manifest with version 1 and empty collections", () => {
    const m = newManifest();
    expect(m.version).toBe(1);
    expect(m.files).toEqual({});
    expect(m.packages).toEqual({});
    expect(m.metadata.appmode).toBe("");
  });
});

describe("addFile", () => {
  it("adds a file with its MD5 checksum", () => {
    const m = newManifest();
    const md5 = Buffer.from([0x00, 0x01, 0x02]);
    addFile(m, "app.py", md5);

    expect(m.files["app.py"]).toEqual({ checksum: "000102" });
  });

  it("adds multiple files", () => {
    const m = newManifest();
    addFile(m, "app.py", Buffer.from([0xab, 0xcd]));
    addFile(m, "requirements.txt", Buffer.from([0x12, 0x34]));

    expect(Object.keys(m.files)).toHaveLength(2);
    expect(m.files["app.py"]?.checksum).toBe("abcd");
    expect(m.files["requirements.txt"]?.checksum).toBe("1234");
  });

  it("sets content_category to 'site' for _site.yml", () => {
    const m = newManifest();
    addFile(m, "_site.yml", Buffer.from([0x00]));
    expect(m.metadata.content_category).toBe("site");
  });

  it("sets content_category to 'site' for _site.yaml", () => {
    const m = newManifest();
    addFile(m, "_site.yaml", Buffer.from([0x00]));
    expect(m.metadata.content_category).toBe("site");
  });

  it("sets content_category to 'site' for _bookdown.yml", () => {
    const m = newManifest();
    addFile(m, "_bookdown.yml", Buffer.from([0x00]));
    expect(m.metadata.content_category).toBe("site");
  });

  it("sets content_category to 'site' for _bookdown.yaml", () => {
    const m = newManifest();
    addFile(m, "_bookdown.yaml", Buffer.from([0x00]));
    expect(m.metadata.content_category).toBe("site");
  });

  it("matches site config files case-insensitively", () => {
    const m = newManifest();
    addFile(m, "_Site.YML", Buffer.from([0x00]));
    expect(m.metadata.content_category).toBe("site");
  });

  it("does not set content_category for regular files", () => {
    const m = newManifest();
    addFile(m, "app.py", Buffer.from([0x00]));
    expect(m.metadata.content_category).toBeUndefined();
  });
});

describe("manifestToJSON", () => {
  it("produces tab-indented JSON with trailing newline", () => {
    const m = newManifest();
    const json = manifestToJSON(m).toString("utf-8");

    expect(json).toContain("\t");
    expect(json.endsWith("\n")).toBe(true);

    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
  });

  it("round-trips manifest data", () => {
    const m = newManifest();
    m.metadata.appmode = "python-dash";
    m.metadata.entrypoint = "app.py";
    addFile(m, "app.py", Buffer.from([0xab, 0xcd]));

    const json = manifestToJSON(m).toString("utf-8");
    const parsed = JSON.parse(json);

    expect(parsed.metadata.appmode).toBe("python-dash");
    expect(parsed.metadata.entrypoint).toBe("app.py");
    expect(parsed.files["app.py"].checksum).toBe("abcd");
  });
});

describe("cloneManifest", () => {
  it("creates a deep copy", () => {
    const m = newManifest();
    m.metadata.appmode = "python-dash";
    addFile(m, "app.py", Buffer.from([0xab]));

    const clone = cloneManifest(m);

    // Values should be equal
    expect(clone.metadata.appmode).toBe("python-dash");
    expect(clone.files["app.py"]?.checksum).toBe("ab");

    // Mutations should not affect the original
    clone.metadata.appmode = "changed";
    addFile(clone, "other.py", Buffer.from([0xcd]));

    expect(m.metadata.appmode).toBe("python-dash");
    expect(m.files["other.py"]).toBeUndefined();
  });
});

describe("getFilenames", () => {
  it("returns sorted filenames", () => {
    const m = newManifest();
    addFile(m, "z.py", Buffer.from([0x00]));
    addFile(m, "a.py", Buffer.from([0x00]));
    addFile(m, "m.py", Buffer.from([0x00]));

    expect(getFilenames(m)).toEqual(["a.py", "m.py", "z.py"]);
  });

  it("returns empty array for empty manifest", () => {
    const m = newManifest();
    expect(getFilenames(m)).toEqual([]);
  });
});

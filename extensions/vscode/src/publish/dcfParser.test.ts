// Copyright (C) 2026 by Posit Software, PBC.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { parseDcf } from "./dcfParser";

describe("parseDcf", () => {
  test("parses multiple records separated by blank lines", () => {
    const input = "a: 1\nb: 2\n\na: 3\nb: 4\n";
    const records = parseDcf(input);
    expect(records).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });

  test("handles continuation lines (strips whitespace by default)", () => {
    const input = "s: abc\n  def \n\nt: \n  ghi";
    const records = parseDcf(input);
    expect(records).toEqual([{ s: "abc\ndef" }, { t: "ghi" }]);
  });

  test("keepWhiteFields preserves indentation on continuation lines", () => {
    // "s" is in keepWhiteFields so its continuation keeps leading spaces;
    // "t" is not, so its continuation gets trimmed.
    const input = "s: abc \n  def \nt: abc \n  def ";
    const records = parseDcf(input, ["s"]);
    expect(records).toEqual([{ s: "abc \n  def", t: "abc\ndef" }]);
  });

  test("keepWhiteFields works on the last field in a record", () => {
    const input = "t: abc\n  def \ns: abc\n  def \n\na: 1";
    const records = parseDcf(input, ["s"]);
    expect(records).toEqual([{ s: "abc\n  def", t: "abc\ndef" }, { a: "1" }]);
  });

  test("keepWhiteFields works on the last field of the last record", () => {
    const input = "t: abc\n  def \ns: abc\n  def ";
    const records = parseDcf(input, ["s"]);
    expect(records).toEqual([{ s: "abc\n  def", t: "abc\ndef" }]);
  });

  test("includes last record when file does not end with blank line", () => {
    const input = "a: 1\nb: 2";
    const records = parseDcf(input);
    expect(records).toEqual([{ a: "1", b: "2" }]);
  });

  test("throws on missing colon", () => {
    const input = "a: 1\nabc";
    expect(() => parseDcf(input)).toThrow("missing ':'");
  });

  test("throws on unexpected continuation after blank line", () => {
    const input = "a: 1\n\n  def";
    expect(() => parseDcf(input)).toThrow("unexpected continuation");
  });

  test("normalizes Windows line endings (CRLF)", () => {
    const input = "Package: mypkg\r\nVersion: 1.0\r\nTitle: Hello\r\n";
    const records = parseDcf(input);
    expect(records).toEqual([
      { Package: "mypkg", Version: "1.0", Title: "Hello" },
    ]);
  });

  test("handles colons in values (e.g. URLs)", () => {
    const input =
      "URL: https://example.com:8080/path\nBugReports: https://github.com/org/repo/issues";
    const records = parseDcf(input);
    expect(records).toEqual([
      {
        URL: "https://example.com:8080/path",
        BugReports: "https://github.com/org/repo/issues",
      },
    ]);
  });

  test("handles empty value after colon", () => {
    const input = "Tag:\nOther: value";
    const records = parseDcf(input);
    expect(records).toEqual([{ Tag: "", Other: "value" }]);
  });

  test("handles tab-indented continuation lines", () => {
    const input = "Desc: first line\n\tsecond line\n\tthird line";
    const records = parseDcf(input);
    expect(records).toEqual([{ Desc: "first line\nsecond line\nthird line" }]);
  });

  test("golden: Biobase DESCRIPTION matches expected manifest description", async () => {
    const testdataDir = path.resolve(__dirname, "testdata");
    const descPath = path.join(
      testdataDir,
      "bioc_project",
      "renv_library",
      "Biobase",
      "DESCRIPTION",
    );
    const expectedPath = path.join(
      testdataDir,
      "bioc_project",
      "expected-library.json",
    );

    const [descText, expectedJSON] = await Promise.all([
      readFile(descPath, "utf-8"),
      readFile(expectedPath, "utf-8"),
    ]);

    const keepWhiteFields = [
      "Description",
      "Authors@R",
      "Author",
      "Built",
      "Packaged",
    ];
    const records = parseDcf(descText, keepWhiteFields);
    expect(records).toHaveLength(1);

    const expected = JSON.parse(expectedJSON);
    const expectedDesc = expected["Biobase"].description;
    expect(records[0]).toEqual(expectedDesc);
  });
});

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

  test("golden: Biobase DESCRIPTION matches expected manifest description", async () => {
    const testdataDir = path.resolve(__dirname, "testdata");
    const descPath = path.join(
      testdataDir,
      "bioc_project",
      "renv_library",
      "Biobase",
      "DESCRIPTION",
    );
    // expected.json uses the Go library mapper's expected output
    const goTestdata = path.resolve(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "internal",
      "inspect",
      "dependencies",
      "renv",
      "testdata",
    );
    const expectedPath = path.join(goTestdata, "bioc_project", "expected.json");

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

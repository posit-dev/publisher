import { describe, it, expect } from "vitest";
import { includedFileTooltip, excludedFileTooltip } from "./tooltips";
import { FileMatchSource } from "../../../../../../src/api/types/files";

describe("includedFileTooltip", () => {
  it("should return correct tooltip for included file without reason", () => {
    const file = { rel: "src/index.ts", reason: null };
    const tooltip = includedFileTooltip(file);
    expect(tooltip).toBe(
      "src/index.ts will be included in the next deployment.",
    );
  });

  it("should return correct tooltip for included file with reason", () => {
    const file = {
      rel: "src/config.json",
      reason: {
        fileName: "config.json",
        pattern: "*.json",
        source: FileMatchSource.FILE,
        filePath: "src/config.json",
        exclude: false,
      },
    };
    const tooltip = includedFileTooltip(file);
    expect(tooltip).toBe(
      `src/config.json will be included in the next deployment.\nThe configuration file config.json is including it with the pattern '*.json'`,
    );
  });

  it("should return correct tooltip for entrypoint file", () => {
    const file = { rel: "src/index.ts", reason: null };
    const tooltip = includedFileTooltip(file, { isEntrypoint: true });
    expect(tooltip).toBe(
      `src/index.ts will be included in the next deployment.\nsrc/index.ts is the entrypoint. Entrypoints must be included in the configuration 'files' list.`,
    );
  });

  it("should return correct tooltip for package file", () => {
    const file = { rel: "src/requirements.txt", reason: null };
    const tooltip = includedFileTooltip(file, { isPackageFile: true });
    expect(tooltip).toBe(
      `src/requirements.txt will be included in the next deployment.\nsrc/requirements.txt is a package file. Package files must be included in the configuration 'files' list.`,
    );
  });
});

describe("excludedFileTooltip", () => {
  it("should return correct tooltip for excluded file without reason", () => {
    const file = { rel: "src/index.ts", reason: null };
    const tooltip = excludedFileTooltip(file);
    expect(tooltip).toBe(
      `src/index.ts will be excluded in the next deployment.\nIt did not match any pattern in the configuration 'files' list.`,
    );
  });

  it("should return correct tooltip for excluded file with built-in reason", () => {
    const file = {
      rel: "src/index.ts",
      reason: {
        source: FileMatchSource.BUILT_IN,
        pattern: "*.ts",
        fileName: "config.json",
        filePath: "src/index.ts",
        exclude: true,
      },
    };
    const tooltip = excludedFileTooltip(file);
    expect(tooltip).toBe(
      `src/index.ts will be excluded in the next deployment.\nThis is a built-in exclusion for the pattern: '*.ts' and cannot be overridden.`,
    );
  });

  it("should return correct tooltip for excluded file with permissions error", () => {
    const file = {
      rel: "src/index.ts",
      reason: {
        source: FileMatchSource.PERMISSIONS_ERROR,
        pattern: "",
        fileName: "",
        filePath: "",
        exclude: true,
      },
    };
    const tooltip = excludedFileTooltip(file);
    expect(tooltip).toBe(
      `src/index.ts will be excluded in the next deployment.\nYou don't have permission to access this directory.`,
    );
  });

  it("should return correct tooltip for excluded file with custom reason", () => {
    const file = {
      rel: "src/index.ts",
      reason: {
        fileName: "config.json",
        pattern: "*.ts",
        source: FileMatchSource.FILE,
        filePath: "src/index.ts",
        exclude: true,
      },
    };
    const tooltip = excludedFileTooltip(file);
    expect(tooltip).toBe(
      `src/index.ts will be excluded in the next deployment.\nThe configuration file config.json is excluding it with the pattern '*.ts'`,
    );
  });
});

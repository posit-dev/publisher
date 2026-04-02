import { describe, it, expect, beforeEach } from "vitest";
import { shallowMount } from "@vue/test-utils";
import {
  resetHomeState,
  getFileStore,
  resetFileState,
} from "../../../test/mocks";
import ProjectFile from "./ProjectFile.vue";
import {
  ContentRecordFileType,
  FileMatchSource,
} from "../../../../../../src/api/types/files";
import type { FlatFile } from "src/utils/files";

function makeFlatFile(overrides: Partial<FlatFile> = {}): FlatFile {
  return {
    id: "test.py",
    fileType: ContentRecordFileType.REGULAR,
    base: "test.py",
    reason: null,
    isDir: false,
    isFile: true,
    modifiedDatetime: new Date().toISOString(),
    rel: "test.py",
    relDir: ".",
    size: 100,
    fileCount: 1,
    abs: "/project/test.py",
    allIncluded: false,
    allExcluded: true,
    indent: 0,
    ...overrides,
  };
}

function makeIncludedFile(overrides: Partial<FlatFile> = {}): FlatFile {
  return makeFlatFile({
    reason: {
      source: FileMatchSource.FILE,
      pattern: "*.py",
      fileName: "config.toml",
      filePath: "config.toml",
      exclude: false,
    },
    allIncluded: true,
    allExcluded: false,
    ...overrides,
  });
}

function makeDirectory(overrides: Partial<FlatFile> = {}): FlatFile {
  return makeFlatFile({
    id: "src",
    fileType: ContentRecordFileType.DIRECTORY,
    base: "src",
    rel: "src",
    isDir: true,
    isFile: false,
    fileCount: 3,
    allIncluded: false,
    allExcluded: true,
    ...overrides,
  });
}

function mountComponent(file: FlatFile) {
  return shallowMount(ProjectFile, {
    props: { file },
  });
}

function getTreeItemCheckbox(wrapper: ReturnType<typeof mountComponent>) {
  return wrapper.findComponent({ name: "TreeItemCheckbox" });
}

describe("ProjectFile", () => {
  beforeEach(() => {
    resetHomeState();
    resetFileState();
  });

  describe("checkState", () => {
    it("passes checked for an included file", () => {
      const wrapper = mountComponent(makeIncludedFile());
      expect(getTreeItemCheckbox(wrapper).props("state")).toBe("checked");
    });

    it("passes unchecked for an excluded file", () => {
      const wrapper = mountComponent(
        makeFlatFile({
          reason: {
            source: FileMatchSource.FILE,
            pattern: "*.log",
            fileName: "config.toml",
            filePath: "config.toml",
            exclude: true,
          },
        }),
      );
      expect(getTreeItemCheckbox(wrapper).props("state")).toBe("unchecked");
    });

    it("passes unchecked for a file with no reason", () => {
      const wrapper = mountComponent(makeFlatFile());
      expect(getTreeItemCheckbox(wrapper).props("state")).toBe("unchecked");
    });

    it("passes checked for a directory with all children included", () => {
      const wrapper = mountComponent(
        makeDirectory({ allIncluded: true, allExcluded: false }),
      );
      expect(getTreeItemCheckbox(wrapper).props("state")).toBe("checked");
    });

    it("passes unchecked for a directory with all children excluded", () => {
      const wrapper = mountComponent(
        makeDirectory({ allIncluded: false, allExcluded: true }),
      );
      expect(getTreeItemCheckbox(wrapper).props("state")).toBe("unchecked");
    });

    it("passes indeterminate for a directory with mixed children", () => {
      const wrapper = mountComponent(
        makeDirectory({
          allIncluded: false,
          allExcluded: false,
          fileCount: 5,
        }),
      );
      expect(getTreeItemCheckbox(wrapper).props("state")).toBe("indeterminate");
    });

    it("passes unchecked for an empty directory", () => {
      const wrapper = mountComponent(
        makeDirectory({
          allIncluded: false,
          allExcluded: false,
          fileCount: 0,
        }),
      );
      expect(getTreeItemCheckbox(wrapper).props("state")).toBe("unchecked");
    });
  });

  describe("listStyle", () => {
    it("uses default for a checked file", () => {
      const wrapper = mountComponent(makeIncludedFile());
      expect(getTreeItemCheckbox(wrapper).props("listStyle")).toBe("default");
    });

    it("uses deemphasized for an unchecked file", () => {
      const wrapper = mountComponent(makeFlatFile());
      expect(getTreeItemCheckbox(wrapper).props("listStyle")).toBe(
        "deemphasized",
      );
    });

    it("uses default for an indeterminate directory", () => {
      const wrapper = mountComponent(
        makeDirectory({
          allIncluded: false,
          allExcluded: false,
          fileCount: 5,
        }),
      );
      expect(getTreeItemCheckbox(wrapper).props("listStyle")).toBe("default");
    });

    it("uses deemphasized for a fully excluded directory", () => {
      const wrapper = mountComponent(
        makeDirectory({ allIncluded: false, allExcluded: true }),
      );
      expect(getTreeItemCheckbox(wrapper).props("listStyle")).toBe(
        "deemphasized",
      );
    });
  });

  describe("tooltip", () => {
    it("shows mixed content message for indeterminate directory", () => {
      const wrapper = mountComponent(
        makeDirectory({
          allIncluded: false,
          allExcluded: false,
          fileCount: 5,
          rel: "src",
        }),
      );
      expect(getTreeItemCheckbox(wrapper).props("tooltip")).toBe(
        "src contains a mix of included and excluded files.",
      );
    });
  });

  describe("events", () => {
    it("calls includeFile when check is emitted", async () => {
      const file = makeFlatFile();
      const wrapper = mountComponent(file);
      await getTreeItemCheckbox(wrapper).vm.$emit("check");
      expect(getFileStore().includeFile).toHaveBeenCalledWith(file);
    });

    it("calls excludeFile when uncheck is emitted", async () => {
      const file = makeIncludedFile();
      const wrapper = mountComponent(file);
      await getTreeItemCheckbox(wrapper).vm.$emit("uncheck");
      expect(getFileStore().excludeFile).toHaveBeenCalledWith(file);
    });
  });
});

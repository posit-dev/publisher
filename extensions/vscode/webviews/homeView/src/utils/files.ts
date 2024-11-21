import { ContentRecordFile } from "../../../../src/api";

export function splitFilesOnInclusion(
  file: ContentRecordFile,
  response: {
    includedFiles: ContentRecordFile[];
    excludedFiles: ContentRecordFile[];
  } = { includedFiles: [], excludedFiles: [] },
): {
  includedFiles: ContentRecordFile[];
  excludedFiles: ContentRecordFile[];
} {
  if (file.isFile) {
    if (file.reason?.exclude === false) {
      response.includedFiles.push(file);
    } else {
      response.excludedFiles.push(file);
    }
  } else {
    // Don't include .posit files in the response
    if (file.id === ".posit") {
      return response;
    }
  }

  file.files.forEach((f) => splitFilesOnInclusion(f, response));

  return response;
}

export function canFileBeIncluded(file: ContentRecordFile): boolean {
  return Boolean(file.reason?.exclude && file.reason?.source !== "built-in");
}

export function canFileBeExcluded(file: ContentRecordFile): boolean {
  return Boolean(!file.reason?.exclude);
}

export type FlatFile = Omit<ContentRecordFile, "files"> & {
  indent: number;
  parent?: string;
};

export function flattenFiles(
  files: ContentRecordFile[],
  map = new Map<string, FlatFile>(),
  indent = 0,
  parentFile?: string,
): Map<string, FlatFile> {
  files.forEach((file) => {
    const { files, ...rest } = file;
    const flatFile = {
      ...rest,
      indent: indent,
      parent: parentFile,
    };
    map.set(file.id, flatFile);
    flattenFiles(file.files, map, indent + 1, file.id);
  });

  return map;
}

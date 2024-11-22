import { ContentRecordFile } from "../../../../src/api";

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
  arr = new Array<FlatFile>(),
  indent = 0,
  parentFile?: string,
): FlatFile[] {
  files.forEach((file) => {
    const { files, ...rest } = file;
    const flatFile = {
      ...rest,
      indent: indent,
      parent: parentFile,
    };
    arr.push(flatFile);
    flattenFiles(file.files, arr, indent + 1, file.id);
  });

  return arr;
}

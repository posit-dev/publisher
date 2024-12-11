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

/**
 * Flattens a ContentRecordFile[] into a FlatFile[] array
 *
 * @param files The ContentRecordFile[] to flatten
 * @param expandedDirs The Set of expanded directories
 * @param arr The array to push the flattened files to
 * @param indent The current indent level
 * @param parentFile The parent file of the directory being flattened
 * @returns
 */
export function flattenFiles(
  files: ContentRecordFile[],
  expandedDirs: Set<string>,
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
    if (file.files.length > 0 && expandedDirs.has(file.id)) {
      flattenFiles(file.files, expandedDirs, arr, indent + 1, file.id);
    }
  });

  return arr;
}

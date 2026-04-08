// Copyright (C) 2026 by Posit Software, PBC.

/**
 * Discover linked resources (images, CSS, scripts, etc.) referenced from
 * content files. Scans file contents via regex and returns additional
 * paths to include in the deployment bundle.
 *
 * @param baseDir - Absolute path to the project root
 * @param files - Current file list (leading-"/" relative paths)
 * @returns Additional "/"-prefixed relative paths to append
 */
export function findLinkedResources(
  _baseDir: string,
  _files: string[],
): Promise<string[]> {
  // TODO: implement
  return Promise.resolve([]);
}

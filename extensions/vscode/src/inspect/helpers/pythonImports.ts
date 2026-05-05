// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs/promises";

/**
 * Check if content contains Python import statements for any of the given packages.
 * Matches `import <pkg>` or `from <pkg>.* import`.
 */
export function hasPythonImports(content: string, packages: string[]): boolean {
  for (const pkg of packages) {
    const re = new RegExp(`import ${pkg}|from ${pkg}.* import`);
    if (re.test(content)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a file contains Python import statements for any of the given packages.
 */
export async function fileHasPythonImports(
  filePath: string,
  packages: string[],
): Promise<boolean> {
  const content = await fs.readFile(filePath, "utf-8");
  return hasPythonImports(content, packages);
}

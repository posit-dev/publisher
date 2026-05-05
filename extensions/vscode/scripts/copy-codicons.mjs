#!/usr/bin/env node
// Copies @vscode/codicons runtime assets into the extension's dist/ so they
// ship inside the .vsix without relying on node_modules layout.
// Needed because vsce (https://github.com/microsoft/vscode-vsce/issues/580)
// can't pack files under workspace-root node_modules, and we use
// `"vsce": { "dependencies": false }` to opt out of its dependency walk.
import { createRequire } from "node:module";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const codiconsDir = dirname(require.resolve("@vscode/codicons/package.json"));
const destDir = "dist/codicons";

mkdirSync(destDir, { recursive: true });
for (const file of ["codicon.css", "codicon.ttf"]) {
  copyFileSync(join(codiconsDir, "dist", file), join(destDir, file));
}

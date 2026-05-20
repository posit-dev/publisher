#!/usr/bin/env node
// Reads each icon-font CSS file under dist/ and rewrites its @font-face
// `url("./<font>?<hash>")` reference to a base64 `data:` URI, writing the
// result to a sibling `*.inlined.css`. The extension's webview HTML reads
// these prebuilt files and injects them as inline <style> blocks so
// Firefox's broken service-worker interception (in Posit Workbench) can't
// fail the stylesheet/font fetches.
// See https://github.com/posit-dev/publisher/issues/4013.
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const targets = [
  {
    cssPath: "dist/codicons/codicon.css",
    fontPath: "dist/codicons/codicon.ttf",
    mimeType: "font/ttf",
    outPath: "dist/codicons/codicon.inlined.css",
  },
  {
    cssPath: "dist/posit-publisher-icons.css",
    fontPath: "dist/posit-publisher-icons.woff2",
    mimeType: "font/woff2",
    outPath: "dist/posit-publisher-icons.inlined.css",
  },
];

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

for (const { cssPath, fontPath, mimeType, outPath } of targets) {
  const cssContent = readFileSync(cssPath, "utf8");
  const fontBase64 = readFileSync(fontPath).toString("base64");
  const fontBasename = basename(fontPath);
  const pattern = new RegExp(
    `url\\(\\s*["']\\.\\/${escapeRegExp(fontBasename)}[^"']*["']\\s*\\)`,
  );
  if (!pattern.test(cssContent)) {
    throw new Error(
      `inline-icon-fonts: did not find url("./${fontBasename}...") reference in ${cssPath}`,
    );
  }
  const inlined = cssContent.replace(
    pattern,
    `url("data:${mimeType};base64,${fontBase64}")`,
  );
  writeFileSync(outPath, inlined);
  console.log(`info: wrote ${outPath} (${inlined.length} bytes)`);
}

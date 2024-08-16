const path = require("path");

// fantasticon does not support windows paths, this fixes the input path for windows
// https://github.com/tancredi/fantasticon/pull/510
const fixWindowsPath = (p) =>
  process.platform === "win32" ? p.replace(/\\/g, "/") : p;
const inputDir = fixWindowsPath(path.join(__dirname, "assets", "icons"));
const outputDir = fixWindowsPath(path.join(__dirname, "dist"));
const codepoints = fixWindowsPath(
  path.join(__dirname, "assets", "icons", "template", "mapping.json"),
);

/** @type {import('@twbs/fantasticon').RunnerOptions} */
const config = {
  name: "posit-publisher-icons",
  prefix: "posit-publisher-icons",
  codepoints: codepoints,
  inputDir: inputDir,
  outputDir: outputDir,
  fontTypes: ["woff2"],
  normalize: true,
  assetTypes: ["html", "css", "json"],
  formatOptions: {
    json: {
      indent: 2,
    },
  },
};

module.exports = config;

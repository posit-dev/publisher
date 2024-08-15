const path = require("path");
const codepoints = require(
  path.join(__dirname, "assets", "icons", "template", "mapping.json"),
);

/** @type {import('@twbs/fantasticon').RunnerOptions} */
const config = {
  name: "posit-publisher-icons",
  prefix: "posit-publisher-icons",
  codepoints: codepoints,
  inputDir: path.join(__dirname, "assets", "icons"),
  outputDir: path.join(__dirname, "dist"),
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

const codepoints = require("./assets/icons/template/mapping.json");

/** @type {import('@twbs/fantasticon').RunnerOptions} */
const config = {
  name: "posit-publisher-icons",
  prefix: "posit-publisher-icons",
  codepoints: codepoints,
  inputDir: "./assets/icons",
  outputDir: "./dist",
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

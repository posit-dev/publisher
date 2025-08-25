const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function findOpInPath() {
  try {
    const which = process.platform === "win32" ? "where" : "which";
    const opPath = execSync(`${which} op`, { encoding: "utf8" })
      .split(/\r?\n/)[0]
      .trim();
    if (opPath && fs.existsSync(opPath)) {
      return opPath;
    }
  } catch {
    // ignore errors, treat as not found
  }
  return null;
}

function get1PasswordSecret(item, field, vault) {
  try {
    const localOp = path.resolve(
      __dirname,
      "../../bin",
      process.platform === "win32" ? "op.exe" : "op",
    );
    const opCommand =
      findOpInPath() || (fs.existsSync(localOp) ? localOp : "op");
    const result = execSync(
      `"${opCommand}" item get "${item}" --field "${field}" --vault "${vault}" --reveal`,
      { encoding: "utf8" },
    );
    return result.trim();
  } catch (error) {
    console.warn(
      `Warning: Could not fetch 1Password secret '${item}': ${error.message}`,
    );
    return "PLACEHOLDER_PASSWORD";
  }
}

module.exports = { get1PasswordSecret };

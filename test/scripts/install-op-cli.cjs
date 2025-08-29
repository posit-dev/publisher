const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const platform = process.platform;
const arch = process.arch;

const archMap = {
  x64: "amd64",
  arm64: "arm64",
};
const mappedArch = archMap[arch] || arch;

const version = "v2.32.0"; // Update to desired OP CLI version here
const downloads = {
  "darwin-amd64": `https://cache.agilebits.com/dist/1P/op2/pkg/${version}/op_darwin_amd64_${version}.zip`,
  "darwin-arm64": `https://cache.agilebits.com/dist/1P/op2/pkg/${version}/op_darwin_arm64_${version}.zip`,
  "linux-amd64": `https://cache.agilebits.com/dist/1P/op2/pkg/${version}/op_linux_amd64_${version}.zip`,
  "win32-amd64": `https://cache.agilebits.com/dist/1P/op2/pkg/${version}/op_windows_amd64_${version}.zip`,
};

const platformKey = `${platform}-${mappedArch}`;
const downloadUrl = downloads[platformKey];

if (!downloadUrl) {
  console.warn(`1Password CLI not available for platform: ${platformKey}`);
  process.exit(0);
}

const binDir = path.join(__dirname, "..", "bin");
const opPath = path.join(binDir, platform === "win32" ? "op.exe" : "op");

// Helper to check if op is in PATH
function findOpInPath() {
  try {
    const which = platform === "win32" ? "where" : "which";
    const opPath = execSync(`${which} op`, { encoding: "utf8" })
      .split(/\r?\n/)[0]
      .trim();
    if (opPath && fs.existsSync(opPath)) {
      return opPath;
    }
  } catch (e) {}
  return null;
}

let opBinary = null;
if (findOpInPath()) {
  opBinary = findOpInPath();
  console.log(`1Password CLI already found in PATH at: ${opBinary}`);
} else if (fs.existsSync(opPath)) {
  opBinary = opPath;
  console.log("1Password CLI already installed");
}

const showAuthInstructions = () => {
  console.log(
    "The CLI will be used automatically by the test suite. No PATH changes required.\n",
  );
  function isDesktopAppInstalled() {
    if (platform === "darwin") {
      return fs.existsSync("/Applications/1Password.app");
    } else if (platform === "win32") {
      return fs.existsSync("C:\\Program Files\\1Password\\1Password.exe");
    } else if (platform === "linux") {
      return (
        fs.existsSync("/usr/bin/1password") ||
        fs.existsSync("/usr/local/bin/1password")
      );
    }
    return false;
  }
  // Check if already signed in
  let alreadySignedIn = false;
  try {
    if (opBinary) {
      const result = execSync(`${opBinary} account list --format json`, {
        encoding: "utf8",
      });
      const accounts = JSON.parse(result);
      alreadySignedIn =
        Array.isArray(accounts) &&
        accounts.some((acc) => acc.state === "signed_in");
    }
  } catch (e) {
    // ignore errors, treat as not signed in
  }
  console.log(
    "\n================ 1Password CLI Authentication =================\n",
  );
  if (alreadySignedIn) {
    console.log("✅ 1Password CLI is already signed in and ready to use.\n");
  } else {
    const evalCmd =
      opBinary && opBinary !== opPath
        ? "eval $(op signin)"
        : "eval $(../bin/op signin)";
    const addCmd =
      opBinary && opBinary !== opPath
        ? "op account add"
        : "../bin/op account add";
    if (isDesktopAppInstalled()) {
      console.log(
        "To authenticate the CLI, enable 'Integrate with 1Password CLI' in the desktop app's Preferences → Developer, then run:",
      );
      console.log(`  ${evalCmd}\n`);
      console.log("(Sign-in URL: positpbc.1password.com)\n");
    } else {
      console.log(
        "To authenticate the CLI (if not already signed in), run the following:\n",
      );
      console.log(`  ${addCmd}`);
      console.log(`  ${evalCmd}\n`);
      console.log("(Sign-in URL: positpbc.1password.com)\n");
    }
  }
  console.log(
    "==============================================================\n",
  );
};

if (opBinary) {
  showAuthInstructions();
  process.exit(0);
}

// Only create binDir if we need to download the CLI
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}
const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          return downloadFile(response.headers.location, dest)
            .then(resolve)
            .catch(reject);
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", reject);
  });
};

async function installCLI() {
  try {
    const zipPath = path.join(binDir, "op.zip");
    await downloadFile(downloadUrl, zipPath);

    console.log("Extracting 1Password CLI...");
    if (platform === "win32") {
      execSync(
        `powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${binDir}'"`,
        { stdio: "inherit" },
      );
    } else {
      execSync(`unzip -q "${zipPath}" -d "${binDir}"`, { stdio: "inherit" });
    }
    if (platform !== "win32") {
      fs.chmodSync(opPath, "755");
    }
    fs.unlinkSync(zipPath);

    console.log(`✅ 1Password CLI ${version} installed at: ${opPath}`);
    showAuthInstructions();
  } catch (error) {
    console.error("Failed to install 1Password CLI:", error.message);
    process.exit(1);
  }
}

if (!fs.existsSync(opPath)) {
  installCLI();
} else {
  showAuthInstructions();
}

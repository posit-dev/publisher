import { browser } from "@wdio/globals";
import { exec } from "child_process";
import { promises as fs } from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function switchToSubframe() {
  await browser.$(".webview");
  const iframe = await browser.$("iframe");
  await browser.switchToFrame(iframe);

  await browser.$("iframe").waitForExist({ timeout: 3000 });
  const subiframe = await browser.$("iframe");
  await subiframe.waitForExist({ timeout: 3000 });
  await browser.switchToFrame(subiframe);
}

export async function waitForInputFields(inputText: string) {
  // wait until the server responds
  await browser.waitUntil(
    async () => {
      const element = await browser.$("#quickInput_message");
      console.warn("quickInput_message html: ", element.getHTML());
      const text = await element.getText();
      console.warn("quickInput_message text: ", text);
      return text.includes(inputText);
    },
    {
      timeout: 7000, // Timeout in milliseconds, adjust as necessary
      timeoutMsg:
        "Expected element signifying server response did not appear within timeout",
    },
  );
}

export function runShellScript(scriptPath: string) {
  return new Promise((resolve, reject) => {
    exec(scriptPath, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return reject(error);
      }
      console.log(`stdout: ${stdout}`);
      console.error(`stderr: ${stderr}`);
      resolve(stdout);
    });
  });
}

export async function getConfigTitle(configName: RegExp) {
  const workbench = await browser.getWorkbench();
  const openEditorTitles = await workbench
    .getEditorView()
    .getOpenEditorTitles();
  const fileNamePattern = configName;
  const realFilename = openEditorTitles.find((title) =>
    fileNamePattern.test(title),
  );
  return realFilename;
}

export async function createfastAPIConfigFile() {
  const configContent = `
# Configuration file generated by Posit Publisher.
# Please review and modify as needed. See the documentation for more options:
# https://github.com/posit-dev/publisher/blob/main/docs/configuration.md
'$schema' = 'https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json'
type = 'python-fastapi'
entrypoint = 'simple.py'
validate = true
files = [
  '/simple.py',
  '/requirements.txt'
]
title = 'fastapi-simple'

[python]
version = '3.11.4'
package_file = 'requirements.txt'
package_manager = 'pip'
`;
  const dirPath = path.join(
    __dirname,
    "../../sample-content/fastapi-simple/.posit/publish/",
  );
  const filePath = path.join(dirPath, "fastapi-simple-VO48.toml");
  try {
    // Create the directory if it doesn't exist
    await fs.mkdir(dirPath, { recursive: true });

    // Write the file
    await fs.writeFile(filePath, configContent);
    console.log(`File created at ${filePath}`);
  } catch (error) {
    console.error(`Error creating file at ${filePath}: ${error}`);
  }
}

export async function createFastAPIDeploymentFile() {
  const deploymentContent = `
# This file is automatically generated by Posit Publisher; do not edit.
'$schema' = 'https://cdn.posit.co/publisher/schemas/posit-publishing-record-schema-v3.json'
server_type = 'connect'
server_url = 'https://rsc.radixu.com'
client_version = '1.1.7-71-g277a42c1'
created_at = '2024-10-03T09:04:42-04:00'
type = 'python-fastapi'
configuration_name = 'fastapi-simple-VO48'
id = '2706293c-eac5-400c-80d0-244ff2c4277b'
dashboard_url = 'https://rsc.radixu.com/connect/#/apps/2706293c-eac5-400c-80d0-244ff2c4277b'
direct_url = 'https://rsc.radixu.com/content/2706293c-eac5-400c-80d0-244ff2c4277b/'
logs_url = 'https://rsc.radixu.com/connect/#/apps/2706293c-eac5-400c-80d0-244ff2c4277b/logs'
deployed_at = '2024-10-03T09:04:52-04:00'
bundle_id = '153804'
bundle_url = 'https://rsc.radixu.com/__api__/v1/content/2706293c-eac5-400c-80d0-244ff2c4277b/bundles/153804/download'
files = [
  'requirements.txt',
  'simple.py'
]
requirements = [
  'fastapi'
]

[configuration]
'$schema' = 'https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json'
type = 'python-fastapi'
entrypoint = 'simple.py'
validate = true
files = [
  '/simple.py',
  '/requirements.txt'
]
title = 'fastapi-simple'

[configuration.python]
version = '3.11.4'
package_file = 'requirements.txt'
package_manager = 'pip'

`;
  const dirPath = path.join(
    __dirname,
    "../../sample-content/fastapi-simple/.posit/publish/deployments",
  );
  const filePath = path.join(dirPath, "deployment-OT7I.toml");
  try {
    // Create the directory if it doesn't exist
    await fs.mkdir(dirPath, { recursive: true });

    // Write the file
    await fs.writeFile(filePath, deploymentContent);
    console.log(`File created at ${filePath}`);
  } catch (error) {
    console.error(`Error creating file at ${filePath}: ${error}`);
  }
}

export async function createErrorFastAPIConfigFile() {
  const configContent = `
# Configuration file generated by Posit Publisher.
# Please review and modify as needed. See the documentation for more options:
# https://github.com/posit-dev/publisher/blob/main/docs/configuration.md
'$schema' = 'https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json'
type = 'python-fastapi'
entrypoint = 'simple.py'
validate = true
files = [
  '/simple.py',
  '/requirements.txt'
]
title = 'fastapi-simple'

[python]
version = '3.11.4'
package_file = 'requirements.txt'
package_manager = 'pip'

[not_a_real_section]
not_a_real_key = 'not_a_real_value'
`;
  const dirPath = path.join(
    __dirname,
    "../../sample-content/fastapi-simple/.posit/publish/",
  );
  const filePath = path.join(dirPath, "fastapi-simple-VO48.toml");
  try {
    // Create the directory if it doesn't exist
    await fs.mkdir(dirPath, { recursive: true });

    // Write the file
    await fs.writeFile(filePath, configContent);
    console.log(`File created at ${filePath}`);
  } catch (error) {
    console.error(`Error creating file at ${filePath}: ${error}`);
  }
}

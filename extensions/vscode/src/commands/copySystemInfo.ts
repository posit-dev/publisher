// Copyright (C) 2025 by Posit Software, PBC.

import { env, version, window, ExtensionContext } from "vscode";

/**
 * Command to copy system information to clipboard for issue reporting
 */
export async function copySystemInfoCommand(
  context: ExtensionContext,
): Promise<void> {
  const extensionVersion = context.extension.packageJSON.version || "unknown";

  const systemInfo = [
    "## System Information",
    "",
    `- **Posit Publisher Version**: ${extensionVersion}`,
    `- **Platform**: ${process.platform} ${process.arch}`,
    `- **IDE**: ${env.appName} ${version}`,
  ].join("\n");

  await env.clipboard.writeText(systemInfo);
  window.showInformationMessage("System info copied to clipboard!");
}

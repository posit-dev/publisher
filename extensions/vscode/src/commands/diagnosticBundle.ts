// Copyright (C) 2025 by Posit Software, PBC.

import { execFile } from "child_process";
import path from "node:path";
import { env, version, window, workspace, ExtensionContext, Uri } from "vscode";
import { logger } from "src/logging";

const VERSION_TIMEOUT = 15000;

export interface DiagnosticInfo {
  extensionVersion: string;
  platform: string;
  arch: string;
  ide: string;
  ideVersion: string;
  pythonVersion: string;
  rVersion: string;
  quartoVersion: string;
  workspaceFolders: string[];
  timestamp: string;
}

export async function diagnosticBundleCommand(
  context: ExtensionContext,
): Promise<void> {
  const extensionVersion = context.extension.packageJSON.version || "unknown";

  const progress = window.withProgress(
    {
      location: { viewId: "posit.publisher.homeView" },
      title: "Generating diagnostic bundle...",
    },
    async () => {
      const [pythonVersion, rVersion, quartoVersion] = await Promise.allSettled(
        [
          getCommandVersion("python3", [
            "-E",
            "-c",
            'import sys; v = sys.version_info; print("%d.%d.%d" % (v[0], v[1], v[2]))',
          ]),
          getCommandVersion("R", ["--version"]),
          getCommandVersion("quarto", ["--version"]),
        ],
      );

      const workspaceFolders = (workspace.workspaceFolders || []).map(
        (f) => f.uri.fsPath,
      );

      const info: DiagnosticInfo = {
        extensionVersion,
        platform: process.platform,
        arch: process.arch,
        ide: env.appName,
        ideVersion: version,
        pythonVersion: extractSettled(pythonVersion),
        rVersion: extractSettled(rVersion, parseRVersion),
        quartoVersion: extractSettled(quartoVersion),
        workspaceFolders,
        timestamp: new Date().toISOString(),
      };

      const bundleText = formatDiagnosticBundle(info);

      const saveUri = await window.showSaveDialog({
        defaultUri: Uri.file(
          path.join(
            workspaceFolders[0] || process.env.HOME || "",
            "posit-publisher-diagnostics.txt",
          ),
        ),
        filters: { "Text Files": ["txt"], "All Files": ["*"] },
        title: "Save Diagnostic Bundle",
      });

      if (saveUri) {
        await workspace.fs.writeFile(saveUri, Buffer.from(bundleText, "utf-8"));
        window.showInformationMessage(
          `Diagnostic bundle saved to ${saveUri.fsPath}`,
        );
        logger.info(`Diagnostic bundle saved to ${saveUri.fsPath}`);
      }
    },
  );

  await progress;
}

export function extractSettled(
  result: PromiseSettledResult<string>,
  parser?: (raw: string) => string,
): string {
  if (result.status === "fulfilled" && result.value) {
    const raw = result.value.trim();
    return parser ? parser(raw) : raw;
  }
  return "not found";
}

export function parseRVersion(raw: string): string {
  const rVersionRe = /^R version (\d+\.\d+\.\d+)/m;
  const match = rVersionRe.exec(raw);
  if (match?.[1]) {
    return match[1];
  }
  const firstLine = raw.split("\n")[0]?.trim();
  return firstLine || "";
}

export function getCommandVersion(
  command: string,
  args: string[],
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { timeout: VERSION_TIMEOUT },
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        const output = (stdout || "") + (stderr || "");
        resolve(output.trim());
      },
    );
  });
}

export function formatDiagnosticBundle(info: DiagnosticInfo): string {
  const lines = [
    "=== Posit Publisher Diagnostic Bundle ===",
    `Generated: ${info.timestamp}`,
    "",
    "## System Information",
    `Posit Publisher Version: ${info.extensionVersion}`,
    `Platform: ${info.platform} ${info.arch}`,
    `IDE: ${info.ide} ${info.ideVersion}`,
    "",
    "## Language Runtimes",
    `Python: ${info.pythonVersion}`,
    `R: ${info.rVersion}`,
    `Quarto: ${info.quartoVersion}`,
    "",
    "## Workspace",
    ...info.workspaceFolders.map((f) => `- ${f}`),
    "",
    "## Extension Log",
    "(Open the Posit Publisher output channel for full logs:",
    ' Run "Posit Publisher: Show Debug Log" from the Command Palette)',
    "",
  ];

  return lines.join("\n");
}

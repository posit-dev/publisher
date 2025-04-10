// Copyright (C) 2025 by Posit Software, PBC.

import { promises as fs } from "fs";
import path from "path";
import os from "os";

async function getConfigFile(configFilePath: string): Promise<string | null> {
  const configDirs = process.env.XDG_CONFIG_DIRS
    ? process.env.XDG_CONFIG_DIRS.split(":")
    : ["/etc"];

  // Iterate over the directories and check if the file exists
  for (const dir of configDirs) {
    const filePath = path.join(dir, configFilePath);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      // skip this file
    }
  }

  return null;
}

export async function getXDGConfigProperty(
  configFilePath: string,
  propertyName: string,
): Promise<string | null> {
  if (os.platform() !== "linux" && os.platform() !== "darwin") return null;

  const filePath = await getConfigFile(configFilePath);
  if (!filePath) return null;

  const fileContent = await fs.readFile(filePath, "utf-8");

  const lines = fileContent.split("\n");

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("#")) {
      continue;
    }

    const [name, value] = trimmedLine.split("=", 2);

    if (name && name.trim() === propertyName) {
      return value ? value.trim() : null;
    }
  }
  return null;
}

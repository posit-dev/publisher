// Copyright (C) 2026 by Posit Software, PBC.

import { extensions } from "vscode";

const QUARTO_EXTENSION_ID = "quarto.quarto";

// The API returned by the Quarto extension's activate().
interface QuartoExtensionApi {
  getQuartoPath(): string | undefined;
}

// Returns getQuartoPath() from the Quarto extension (currently the bin
// directory of its selected Quarto CLI), activating it if needed. Undefined
// when the extension isn't installed or didn't find Quarto.
export async function getQuartoExtensionPath(): Promise<string | undefined> {
  const ext =
    extensions.getExtension<Partial<QuartoExtensionApi>>(QUARTO_EXTENSION_ID);
  if (!ext) {
    return undefined;
  }
  const api = ext.isActive ? ext.exports : await ext.activate();
  return api?.getQuartoPath?.();
}

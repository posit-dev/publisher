// Copyright (C) 2024 by Posit Software, PBC.

import { workspace } from "vscode";

export const path = (): string | undefined => {
  return workspace.workspaceFolders?.at(0)?.uri.fsPath;
};

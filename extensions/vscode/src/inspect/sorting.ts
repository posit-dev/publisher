// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";
import { ContentType } from "src/api/types/configurations";
import { PartialConfig } from "./types";

const preferredNames = ["index", "main", "app", "streamlit_app"];

// Lower values are preferred (sorted first).
const contentTypePriority: Partial<Record<ContentType, number>> = {
  [ContentType.QUARTO_STATIC]: 1,
  [ContentType.JUPYTER_NOTEBOOK]: 2,
  [ContentType.RMD]: 3,
};

function getContentTypePriority(type: ContentType): number {
  return contentTypePriority[type] ?? 100;
}

function filenameStem(filename: string): string {
  return path.basename(filename, path.extname(filename));
}

/**
 * Sort configs by priority:
 * 1. Preferred entrypoint names come first (dir basename, index, main, app, streamlit_app)
 * 2. Same entrypoint: sort by content type priority, then alphabetically by type
 * 3. Different entrypoints: sort alphabetically by entrypoint
 */
export function sortConfigs(
  configs: PartialConfig[],
  dirBasename: string,
): PartialConfig[] {
  return configs.slice().sort((a, b) => {
    const stemA = filenameStem(a.entrypoint);
    const stemB = filenameStem(b.entrypoint);

    const aIsPreferred =
      dirBasename === stemA || preferredNames.includes(stemA);
    const bIsPreferred =
      dirBasename === stemB || preferredNames.includes(stemB);

    if (aIsPreferred && !bIsPreferred) {
      return -1;
    } else if (!aIsPreferred && bIsPreferred) {
      return 1;
    } else {
      if (a.entrypoint === b.entrypoint) {
        const priorityA = getContentTypePriority(a.type);
        const priorityB = getContentTypePriority(b.type);
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        return a.type.localeCompare(b.type);
      } else {
        return a.entrypoint.localeCompare(b.entrypoint);
      }
    }
  });
}

// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";
import { ContentType } from "src/api/types/configurations";
import { ContentTypeDetector, PartialConfig } from "./types";
import { sortConfigs } from "./sorting";
import { NotebookDetector } from "./detectors/notebook";
import { RShinyDetector } from "./detectors/rshiny";
import { PyShinyDetector } from "./detectors/pyshiny";
import {
  newFastAPIDetector,
  newFlaskDetector,
  newDashDetector,
  newGradioDetector,
  newPanelDetector,
  newStreamlitDetector,
  newBokehDetector,
} from "./detectors/pythonApp";
import { StaticHTMLDetector } from "./detectors/html";

/**
 * Create the ordered list of detectors.
 * The order matches Go's detectors/all.go.
 * Plumber, RMarkdown, and Quarto are deferred to a follow-up PR.
 */
function createDetectors(): ContentTypeDetector[] {
  return [
    // NewPlumberDetector — deferred
    // NewRMarkdownDetector — deferred
    new NotebookDetector(),
    // NewQuartoDetector — deferred
    new RShinyDetector(),
    new PyShinyDetector(),
    newFastAPIDetector(),
    newFlaskDetector(),
    newDashDetector(),
    newGradioDetector(),
    newPanelDetector(),
    newStreamlitDetector(),
    newBokehDetector(),
    new StaticHTMLDetector(),
  ];
}

function newUnknownConfig(): PartialConfig {
  return {
    type: ContentType.UNKNOWN,
    entrypoint: "",
  };
}

/**
 * Run all detectors against a directory and return sorted results.
 * If no detectors match, returns a single unknown config.
 */
export async function runDetectors(
  baseDir: string,
  entrypoint?: string,
): Promise<PartialConfig[]> {
  const detectors = createDetectors();
  const allConfigs: PartialConfig[] = [];

  for (const detector of detectors) {
    const configs = await detector.inferType(baseDir, entrypoint);
    if (configs.length > 0) {
      allConfigs.push(...configs);
    }
  }

  if (allConfigs.length === 0) {
    allConfigs.push(newUnknownConfig());
  }

  return sortConfigs(allConfigs, path.basename(baseDir));
}

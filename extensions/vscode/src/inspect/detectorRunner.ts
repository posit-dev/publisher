// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";
import { ContentType } from "src/api/types/configurations";
import { logger } from "src/logging";
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
import { PlumberDetector } from "./detectors/plumber";
import { RMarkdownDetector } from "./detectors/rmarkdown";
import { QuartoDetector } from "./detectors/quarto";

/**
 * Create the ordered list of detectors.
 */
function createDetectors(): ContentTypeDetector[] {
  return [
    new PlumberDetector(),
    new RMarkdownDetector(),
    new NotebookDetector(),
    new QuartoDetector(),
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

  logger.debug(
    `[detectorRunner] running ${detectors.length} detectors on ${baseDir}`,
  );

  for (const detector of detectors) {
    const configs = await detector.inferType(baseDir, entrypoint);
    if (configs.length > 0) {
      logger.debug(
        `[detectorRunner] ${detector.constructor.name} produced ${configs.length} config(s)`,
      );
      allConfigs.push(...configs);
    }
  }

  if (allConfigs.length === 0) {
    allConfigs.push(newUnknownConfig());
  }

  return sortConfigs(allConfigs, path.basename(baseDir));
}

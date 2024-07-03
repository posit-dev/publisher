// Copyright (C) 2023 by Posit Software, PBC.

import { ConfigurationInspectionResult, ContentType } from "src/api";

/**
 * Determines if some of the inspections have a known content type.
 *
 * @param inspections The results of an /api/inspect request
 * @returns boolean - if any of the inspections have a known content type
 */
export function hasKnownContentType(
  inspections: ConfigurationInspectionResult[],
) {
  return inspections.some(
    (inspection) => inspection.configuration.type !== ContentType.UNKNOWN,
  );
}

// Copyright (C) 2026 by Posit Software, PBC.

import { ContentTypeDetector, PartialConfig } from "../types";

export class NodejsAppDetector implements ContentTypeDetector {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async inferType(
    baseDir: string,
    entrypoint?: string,
  ): Promise<PartialConfig[]> {
    return [];
  }
}

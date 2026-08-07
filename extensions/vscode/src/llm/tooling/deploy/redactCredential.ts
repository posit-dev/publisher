// Copyright (C) 2026 by Posit Software, PBC.

import { Credential } from "src/api/types/credentials";
import { ServerType } from "src/api/types/contentRecords";

/** Credential fields safe to return to a language model — no secret material. */
export type RedactedCredential = {
  name: string;
  url: string;
  serverType: ServerType;
};

/**
 * Strip all secret material from a credential, leaving only fields safe to
 * return to a language model.
 */
export function redactCredential(c: Credential): RedactedCredential {
  return { name: c.name, url: c.url, serverType: c.serverType };
}

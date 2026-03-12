// Copyright (C) 2026 by Posit Software, PBC.

/**
 * Extract leading comment lines from raw TOML file content.
 * Collects consecutive lines starting with '#' from the top of the file,
 * stripping the '#' prefix. Matches Go's readLeadingComments behavior.
 */
export function readLeadingComments(content: string): string[] {
  const comments: string[] = [];
  for (const line of content.split("\n")) {
    if (!line.startsWith("#")) {
      break;
    }
    comments.push(line.slice(1));
  }
  return comments;
}

/**
 * Recursively strip empty leaf values from an object to match Go's omitempty
 * TOML encoding behavior. Removes keys whose values are:
 * - undefined or null
 * - empty strings ("")
 *
 * Does NOT remove empty objects — Go's TOML encoder writes section headers
 * (e.g., `[r]`) even when all fields are omitted via omitempty, and the
 * JSON schema conditionally requires these sections to exist.
 *
 * Mutates the object in place.
 */
export function stripEmpty(obj: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) {
      delete obj[key];
    } else if (typeof value === "string" && value === "") {
      delete obj[key];
    } else if (isRecord(value)) {
      stripEmpty(value);
    }
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

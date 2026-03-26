// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";
import { ErrorObject } from "ajv/dist/2020";

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

/**
 * Compute a relative projectDir from an absolute path, using "." for the root.
 * Matches Go's convention where projectDir is relative to the workspace root.
 */
export function relativeProjectDir(absDir: string, rootDir: string): string {
  const rel = path.relative(rootDir, absDir);
  return rel === "" ? "." : rel;
}

/**
 * Format ajv validation errors to match Go's schema validation output.
 * Go format: "key: problem" (e.g., "invalidParam: not allowed.")
 * For nested paths: "python.garbage: not allowed."
 *
 * Filters redundant unevaluatedProperties errors when a more specific
 * error exists at the same or deeper path (matching Go's behavior).
 */
export function formatValidationErrors(errors: ErrorObject[]): string {
  // First pass: convert each error to { fullKey, message, isUnevaluated }
  const entries: {
    fullKey: string;
    message: string;
    isUnevaluated: boolean;
  }[] = [];

  for (const e of errors) {
    // Convert JSON pointer instancePath (e.g., "/python") to dotted key
    const pathKey = e.instancePath.replace(/^\//, "").replace(/\//g, ".");

    if (
      e.keyword === "unevaluatedProperties" ||
      e.keyword === "additionalProperties"
    ) {
      const prop =
        e.params.unevaluatedProperty ?? e.params.additionalProperty ?? "";
      const fullKey = pathKey ? `${pathKey}.${prop}` : prop;
      entries.push({
        fullKey,
        message: `${fullKey}: not allowed.`,
        isUnevaluated: e.keyword === "unevaluatedProperties",
      });
    } else if (e.keyword === "required") {
      const prop = e.params.missingProperty ?? "";
      const fullKey = pathKey ? `${pathKey}.${prop}` : prop;
      entries.push({
        fullKey,
        message: `${fullKey}: missing property.`,
        isUnevaluated: false,
      });
    } else if (e.keyword === "if") {
      // "if/then" errors are structural noise from conditional schemas — skip
      continue;
    } else {
      const prefix = pathKey ? `${pathKey}: ` : "";
      entries.push({
        fullKey: pathKey,
        message: `${prefix}${e.message ?? "validation error"}.`,
        isUnevaluated: false,
      });
    }
  }

  // Second pass: filter redundant unevaluatedProperties errors.
  // Go filters these when any other error's key starts with the same key.
  // In Go, the key for unevaluatedProperties includes the property name
  // (e.g., "python.garbage"), so only a deeper error at "python.garbage.x"
  // would trigger filtering. We use fullKey to match that behavior.
  const filtered = entries.filter((entry, i) => {
    if (!entry.isUnevaluated) return true;
    const prefix = entry.fullKey;
    return !entries.some(
      (other, j) => j !== i && other.fullKey.startsWith(prefix),
    );
  });

  return filtered.map((e) => e.message).join("; ");
}

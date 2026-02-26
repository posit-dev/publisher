// Copyright (C) 2026 by Posit Software, PBC.

/**
 * Recursive key transformation between snake_case (TOML) and
 * camelCase (domain types).
 *
 * The TOML configuration files use snake_case keys (e.g. `package_file`,
 * `product_type`), while the domain types use camelCase (e.g.
 * `packageFile`, `productType`). These functions translate between
 * the two representations.
 *
 * TODO: Replace the generic string transform with explicit field-by-field
 * mapping before production use. The generic approach can break on edge
 * cases like `$schema` (no underscores to convert), abbreviations, or
 * keys that don't follow strict snake_case conventions. An explicit map
 * is more verbose but makes each field's conversion obvious and testable.
 */

export function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/**
 * Recursively transform all keys in an object using the given function.
 */
export function transformKeys(
  obj: unknown,
  fn: (key: string) => string,
): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => transformKeys(item, fn));
  }
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[fn(key)] = transformKeys(value, fn);
    }
    return result;
  }
  return obj;
}

// Copyright (C) 2026 by Posit Software, PBC.

/**
 * Convert a snake_case string to camelCase.
 * Already-camelCase strings pass through unchanged.
 */
function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

/**
 * Convert a camelCase string to snake_case.
 * Already-snake_case strings pass through unchanged.
 */
function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

// Keys at these paths contain user-defined names that must not be converted.
const PRESERVE_KEYS_PATHS = new Set(["environment"]);

// Parent keys that signal their child "config" object should be preserved
// as-is (not key-converted), because its keys are user-defined.
// Both forms are needed because parentKey is the already-transformed key,
// which is camelCase or snake_case depending on the conversion direction.
const INTEGRATION_REQUESTS_PARENTS = new Set([
  "integrationRequests",
  "integration_requests",
]);

/**
 * Shared recursive key-conversion engine.
 *
 * @param transform - converts a single key (e.g. snakeToCamel or camelToSnake)
 */
function convertKeys(
  obj: unknown,
  transform: (key: string) => string,
  parentKey?: string,
): unknown {
  if (Array.isArray(obj)) {
    return obj.map((item) => convertKeys(item, transform, parentKey));
  }

  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKey = transform(key);

      if (PRESERVE_KEYS_PATHS.has(key) || PRESERVE_KEYS_PATHS.has(newKey)) {
        result[newKey] = value;
      } else if (
        key === "config" &&
        parentKey !== undefined &&
        INTEGRATION_REQUESTS_PARENTS.has(parentKey)
      ) {
        result[newKey] = value;
      } else {
        result[newKey] = convertKeys(value, transform, newKey);
      }
    }
    return result;
  }

  return obj;
}

/**
 * Recursively convert all object keys from snake_case to camelCase.
 *
 * Exceptions:
 * - Keys inside `environment` maps (user-defined env var names)
 * - Keys inside `config` maps on integration request objects
 */
export function convertKeysToCamelCase(
  obj: unknown,
  parentKey?: string,
): unknown {
  return convertKeys(obj, snakeToCamel, parentKey);
}

/**
 * Recursively convert all object keys from camelCase to snake_case.
 *
 * Exceptions:
 * - Keys inside `environment` maps (user-defined env var names)
 * - Keys inside `config` maps on integration request objects
 */
export function convertKeysToSnakeCase(
  obj: unknown,
  parentKey?: string,
): unknown {
  return convertKeys(obj, camelToSnake, parentKey);
}

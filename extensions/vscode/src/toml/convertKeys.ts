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
  if (Array.isArray(obj)) {
    return obj.map((item) => convertKeysToCamelCase(item, parentKey));
  }

  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = snakeToCamel(key);

      if (PRESERVE_KEYS_PATHS.has(key) || PRESERVE_KEYS_PATHS.has(camelKey)) {
        // Preserve user-defined environment variable names
        result[camelKey] = value;
      } else if (key === "config" && parentKey === "integrationRequests") {
        // Preserve user-defined keys inside integration_requests[].config
        result[camelKey] = value;
      } else {
        result[camelKey] = convertKeysToCamelCase(value, camelKey);
      }
    }
    return result;
  }

  return obj;
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
  if (Array.isArray(obj)) {
    return obj.map((item) => convertKeysToSnakeCase(item, parentKey));
  }

  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = camelToSnake(key);

      if (PRESERVE_KEYS_PATHS.has(key) || PRESERVE_KEYS_PATHS.has(snakeKey)) {
        // Preserve user-defined environment variable names
        result[snakeKey] = value;
      } else if (
        key === "config" &&
        (parentKey === "integrationRequests" ||
          parentKey === "integration_requests")
      ) {
        // Preserve user-defined keys inside integration_requests[].config
        result[snakeKey] = value;
      } else {
        result[snakeKey] = convertKeysToSnakeCase(value, snakeKey);
      }
    }
    return result;
  }

  return obj;
}

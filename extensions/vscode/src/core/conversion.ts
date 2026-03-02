// Copyright (C) 2025 by Posit Software, PBC.

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

/**
 * Recursively converts all object keys from snake_case to camelCase.
 * Skips conversion inside `environment` maps (user-defined env var names).
 */
export function convertKeysToCamelCase(
  obj: unknown,
  insideEnvironment = false,
): unknown {
  if (Array.isArray(obj)) {
    return obj.map((item) => convertKeysToCamelCase(item, false));
  }

  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKey = insideEnvironment ? key : snakeToCamel(key);
      const isEnvironmentKey = key === "environment";
      result[newKey] = convertKeysToCamelCase(value, isEnvironmentKey);
    }
    return result;
  }

  return obj;
}

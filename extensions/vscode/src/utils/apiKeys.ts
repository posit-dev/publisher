// Copyright (C) 2024 by Posit Software, PBC.

/**
 * Validate a Connect API Key\
 *
 * @returns <string | undefined> - the error or undefined for valid
 */
export const validateApiKey = (key: string): string | undefined => {
  if (key.length !== 32) {
    return "Invalid length for an API Key (32 alphanumeric characters required)";
  }
  if (!key.match(/^[ABcdEfgHIJKlMNopqRstuvWXyz012345]+$/i)) {
    return "Invalid characters for an API Key (32 alphanumeric characters required)";
  }
  return undefined;
};

// /^[a-z0-9]+$/i

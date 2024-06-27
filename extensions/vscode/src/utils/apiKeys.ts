// Copyright (C) 2024 by Posit Software, PBC.

/**
 * Validate a Connect API Key\
 *
 * @returns <string | undefined> - the error or undefined for valid
 */
export const checkSyntaxApiKey = (key: string): string | undefined => {
  if (!key.match(/^[\da-zA-Z]{32}$/g)) {
    return "invalid characters or length for an API Key (32 alphanumeric characters required)";
  }
  return undefined;
};

// /^[a-z0-9]+$/i

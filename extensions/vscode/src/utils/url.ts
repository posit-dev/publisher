// Copyright (C) 2024 by Posit Software, PBC.

export const formatURL = (input: string): string => {
  // check if the URL starts with a scheme
  if (/^[a-zA-Z]+:\/\//.test(input)) {
    return input;
  }
  if (input.endsWith("/connect/")) {
    // This is a dashboard URL; trim to get the server URL.
    input = input.slice(0, -8);
  }
  return `https://${input}`;
};

// Currently just adds a trailing slash
export const normalizeURL = (input: string): string => {
  let result = input;
  if (!result.endsWith("/")) {
    result += "/";
  }
  return result;
};

// Copyright (C) 2024 by Posit Software, PBC.

export const GuidRegex =
  /(?:\{{0,1}(?:[0-9a-fA-F]){8}-(?:[0-9a-fA-F]){4}-(?:[0-9a-fA-F]){4}-(?:[0-9a-fA-F]){4}-(?:[0-9a-fA-F]){12}\}{0,1})/;

// Extract GUID from a string
export const extractGUID = (str: string) => {
  return str.match(GuidRegex);
};

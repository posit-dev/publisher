// Copyright (C) 2024 by Posit Software, PBC.

export const normalizeURL = (url: string) => {
  if (!url.endsWith('/')) {
    url += '/';
  }
  return url;
};

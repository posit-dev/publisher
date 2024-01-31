// Copyright (C) 2023 by Posit Software, PBC.

export function sortByDateString(a: string, b: string) {
  return Date.parse(a) > Date.parse(b) ? -1 : 1;
}

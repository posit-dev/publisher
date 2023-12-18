// Copyright (C) 2023 by Posit Software, PBC.

export function formatDateString(dateString: string) {
  return new Date(`${dateString}`).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function sortByDateString(a: string, b: string) {
  return Date.parse(a) > Date.parse(b) ? -1 : 1;
}


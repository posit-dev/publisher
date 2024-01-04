// Copyright (C) 2023 by Posit Software, PBC.

// results in Dec 20, 2023
export function formatDateString(dateString: string) {
  return new Date(`${dateString}`).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// results in Dec 20, 2023, 12:39 PM
export function formatDateTimeString(dateString: string) {
  return new Date(`${dateString}`).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });
}

// Will handle both DateString as well as DateTimeStrings
export function sortByDateString(a: string, b: string) {
  return Date.parse(a) > Date.parse(b) ? -1 : 1;
}

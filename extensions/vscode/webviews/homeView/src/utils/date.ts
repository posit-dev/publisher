// Copyright (C) 2023 by Posit Software, PBC.

// depending on includeTime param, produces:
// includeTime = false: "Dec 20, 2023"
// includeTime = true: "Dec 20, 2023 at 12:39 PM"
export function formatDateString(
  dateString: string,
  { includeTime } = { includeTime: true },
) {
  const dateResult = new Date(`${dateString}`).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  if (!includeTime) {
    return dateResult;
  }
  const timeResult = formatTimeString(dateString);
  return `${dateResult} at ${timeResult}`;
}

export function formatTimeString(
  dateString: string,
  { includeSeconds } = { includeSeconds: false },
) {
  const options: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
  };
  if (includeSeconds) {
    options.second = "2-digit";
  }
  return new Date(`${dateString}`).toLocaleTimeString("en-US", options);
}

export function sortByDateString(a: string, b: string) {
  return Date.parse(a) > Date.parse(b) ? -1 : 1;
}

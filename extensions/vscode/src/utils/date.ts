// Copyright (C) 2023 by Posit Software, PBC.

// depending on includeTime param, produces:
// includeTime = false: "Dec 20, 2023"
// includeTime = true: "Dec 20, 2023 at 12:39 PM"
export function formatDateString(
  dateString: string,
  { includeTime } = { includeTime: true },
) {
  const dateResult = new Date(dateString).toLocaleDateString(undefined, {
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
  return new Date(`${dateString}`).toLocaleTimeString(undefined, options);
}

export function sortByDateString(a: string, b: string) {
  return Date.parse(a) > Date.parse(b) ? -1 : 1;
}

export function stripMilliseconds(dateString: string) {
  // Strip milliseconds while preserving the timezone suffix.
  // Go timestamps end with a 6-char offset like "-04:00".
  // JS toISOString() ends with "Z" (UTC) and includes ".nnnZ" milliseconds.
  const dotIndex = dateString.lastIndexOf(".");
  if (dotIndex === -1) {
    // No fractional seconds — return as-is.
    return dateString;
  }
  const base = dateString.slice(0, dotIndex);
  // Everything after the fractional digits is the timezone suffix.
  // Match the first non-digit after the dot to find where the suffix starts.
  const afterDot = dateString.slice(dotIndex + 1);
  const suffixMatch = afterDot.match(/[^\d]/);
  const suffix = suffixMatch ? afterDot.slice(suffixMatch.index) : "";
  return `${base}${suffix}`;
}

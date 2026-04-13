// Copyright (C) 2026 by Posit Software, PBC.

export type DcfRecord = Record<string, string>;

const WHITESPACE = " \t";

function trimLeft(s: string): string {
  let i = 0;
  while (i < s.length && WHITESPACE.includes(s.charAt(i))) i++;
  return s.slice(i);
}

function trimRight(s: string): string {
  let i = s.length;
  while (i > 0 && WHITESPACE.includes(s.charAt(i - 1))) i--;
  return s.slice(0, i);
}

function trim(s: string): string {
  return trimRight(trimLeft(s));
}

/**
 * Parse DCF (Debian Control File) formatted text into an array of records.
 *
 * This is the format used by R DESCRIPTION files. Each record is a set of
 * key-value pairs separated by blank lines. Continuation lines start with
 * whitespace. Fields listed in `keepWhiteFields` preserve original indentation
 * on continuation lines; all other fields have whitespace trimmed.
 */
export function parseDcf(
  text: string,
  keepWhiteFields: string[] = [],
): DcfRecord[] {
  const records: DcfRecord[] = [];
  let currentRecord: DcfRecord = {};
  let currentTag = "";
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmedLeft = trimLeft(line);

    if (trimmedLeft === "" && Object.keys(currentRecord).length > 0) {
      // Blank line ends the current record
      currentRecord[currentTag] = trimRight(currentRecord[currentTag]!);
      records.push(currentRecord);
      currentRecord = {};
      currentTag = "";
    } else if (trimmedLeft !== line) {
      // Leading whitespace = continuation of current field
      if (currentTag === "") {
        throw new Error(
          `couldn't parse DCF data: unexpected continuation on line ${i + 1}`,
        );
      }
      const value = keepWhiteFields.includes(currentTag) ? line : trim(line);
      if (currentRecord[currentTag] !== "") {
        currentRecord[currentTag] += "\n";
      }
      currentRecord[currentTag] += value;
    } else {
      // New field
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) {
        throw new Error(
          `couldn't parse DCF data: missing ':' on line ${i + 1}`,
        );
      }

      // Right-trim the previous field value
      if (Object.keys(currentRecord).length > 0) {
        currentRecord[currentTag] = trimRight(currentRecord[currentTag]!);
      }

      const tag = line.slice(0, colonIdx);
      const rawValue = line.slice(colonIdx + 1);
      currentRecord[tag] = keepWhiteFields.includes(tag)
        ? trimLeft(rawValue)
        : trim(rawValue);
      currentTag = tag;
    }
  }

  // Include last record if file doesn't end with a blank line
  if (Object.keys(currentRecord).length > 0) {
    currentRecord[currentTag] = trimRight(currentRecord[currentTag]!);
    records.push(currentRecord);
  }

  return records;
}

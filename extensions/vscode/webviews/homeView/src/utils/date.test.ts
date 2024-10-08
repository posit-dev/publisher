// sum.test.js
import { describe, expect, test } from "vitest";

import {
  formatDateString,
  formatTimeString,
  sortByDateString,
} from "src/utils/date";

describe("formatDateString", () => {
  test("defaults to include time", () => {
    const result = formatDateString("2024-07-23T16:38:20-08:00");
    expect(result).toBe("Jul 24, 2024 at 12:38 AM");
  });

  test("includeTime false provides only date", () => {
    const result = formatDateString("2024-07-23T16:38:20-07:00", {
      includeTime: false,
    });
    expect(result).toBe("Jul 23, 2024");
  });

  test("includeTime true includes hour, minute, and period", () => {
    const result = formatDateString("2024-07-23T16:38:20-06:00", {
      includeTime: true,
    });
    expect(result).toBe("Jul 23, 2024 at 10:38 PM");
  });
});

describe("formatTimeString", () => {
  test("defaults to not include seconds", () => {
    const result = formatTimeString("2024-07-23T11:38:20-05:00");
    expect(result).toBe("04:38 PM");
  });

  test("includes seconds when includeSeconds is true", () => {
    const result = formatTimeString("2024-07-23T16:38:20-04:00", {
      includeSeconds: true,
    });
    expect(result).toBe("08:38:20 PM");
  });

  test("formats time with 2-digit hour and minute", () => {
    const result = formatTimeString("2024-07-23T16:38:20-03:00");
    expect(result).toBe("07:38 PM");
  });
});

describe("sortByDateString", () => {
  test("sorts from most recent to oldest", () => {
    const result = [
      "2024-07-23T11:38:20-07:00",
      "2024-07-23T16:38:20-07:00",
    ].sort(sortByDateString);
    expect(result).toEqual([
      "2024-07-23T16:38:20-07:00",
      "2024-07-23T11:38:20-07:00",
    ]);
  });
});

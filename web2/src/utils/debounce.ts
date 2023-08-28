// Copyright (C) 2023 by Posit Software, PBC.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DebounceFn = (...args: any[]) => unknown;

export function debounce<F extends DebounceFn>(
  fn: F,
  wait?: number
): ((...args: Parameters<F>) => void) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
    }, wait);
  };
}

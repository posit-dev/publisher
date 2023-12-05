// Copyright (C) 2023 by Posit Software, PBC.

export function formatDateString(dateString: string) {
  return new Date(`${dateString}`).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}


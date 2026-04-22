// Copyright (C) 2026 by Posit Software, PBC.

import { vi } from "vitest";

export const logger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

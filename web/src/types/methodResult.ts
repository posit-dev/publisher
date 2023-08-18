// Copyright (C) 2023 by Posit Software, PBC.

export type MethodResult = {
  ok: boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result?: any,
  error?: string,
};

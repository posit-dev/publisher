// Copyright (C) 2024 by Posit Software, PBC.

import getPort from "get-port";

export const acquire = (): Promise<number> => {
  return getPort();
};

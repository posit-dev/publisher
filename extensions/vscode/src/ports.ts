// Copyright (C) 2024 by Posit Software, PBC.

import getPort = require("get-port");

export const acquire = (): Promise<number> => {
  return getPort();
};

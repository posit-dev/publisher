// Copyright (C) 2024 by Posit Software, PBC.

import { Mutex, MutexInterface } from "async-mutex";

export const throttleWithLastPending = async (
  mutex: Mutex,
  fn: () => Promise<void>,
) => {
  if (mutex.isLocked()) {
    // we have calls waiting, so cancel them, since we're here now and taking their place
    mutex.cancel();
  }
  let release: MutexInterface.Releaser | undefined;
  try {
    release = await mutex.acquire();
    return await fn();
  } finally {
    if (release) {
      release();
    }
  }
};

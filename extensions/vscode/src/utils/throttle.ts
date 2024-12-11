// Copyright (C) 2024 by Posit Software, PBC.

import { Mutex, MutexInterface } from "async-mutex";

/**
 * This method allows throttling of a method (typically an API call), where only
 * one call is active, and the last one which is requested while an existing call
 * is still active, is then executed after the current call completes.
 *
 * We do not need any intermediate calls to be executed, because we're using this functionality
 * with pure functions, which we simply need to execute the latest request.
 *
 * For example, if all of these come in sequence very quickly, and the API call is long:
 *
 * call() // A
 * call() // B
 * call() // C
 * call() // D
 *
 * Call A will be executed and if it takes a long time, only Call D will be executed. Under the
 * covers, when Call B comes in, it is queued up using the mutex, but then Call C cancels Call B
 * (using mutex.cancel()), and Call C waits on the mutex, then Call D cancels Call C and waits on
 * the mutex, which is then executed when Call A releases the mutex.
 */
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

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

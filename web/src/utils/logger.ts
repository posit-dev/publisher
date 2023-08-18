// Copyright (C) 2023 by Posit Software, PBC.

import { MethodResult } from 'src/types';

export class Logger {
  private debugEnabled = false;
  private prefixString = '';
  private result: MethodResult = { ok: true };

  private initLogging() {
    console.log('Debug logging has been enabled.');
  }

  public logMsg(msg: string) {
    if (this.debugEnabled) {
      console.log(`DEBUG: ${msg}`);
    }
  }

  public logError(msg: string, error: MethodResult) : MethodResult {
    this.logMsg(`DEBUG: ${msg}: error = ${error?.error}`);
    return error;
  }

  public enableLogging(prefix = 'DEBUG') {
    this.prefixString = prefix;
    this.debugEnabled = true;
    this.initLogging();
  }
}

export const logger = new Logger();

export const useLogger = () => logger;

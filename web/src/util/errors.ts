// Copyright (C) 2023 by Posit Software, PBC.

import { Router } from 'vue-router';

export const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

export const routeToErrorPage = (router: Router, errorMsg: string, errorLocation: string) => {
  router.push({
    name: 'fatalError',
    query: {
      msg: errorMsg,
      location: errorLocation,
    },
  });
};

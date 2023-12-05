// Copyright (C) 2023 by Posit Software, PBC.

export const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};


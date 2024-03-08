// Copyright (C) 2023 by Posit Software, PBC.

import { ErrorResponse } from 'src/api/types/error';

export type Requirements = {
  requirements: string[];
};

export type RequirementsResponse = Requirements | ErrorResponse;

export function isRequirementsError(
  r: RequirementsResponse
): r is ErrorResponse {
  return (r as ErrorResponse).error !== undefined;
}

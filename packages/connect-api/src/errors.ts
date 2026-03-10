// Copyright (C) 2026 by Posit Software, PBC.

/** Base error class for all Connect client errors. */
export class ConnectAPIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectAPIError";
  }
}

/** HTTP request returned a non-2xx status. */
export class ConnectRequestError extends ConnectAPIError {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string,
  ) {
    super(`HTTP ${status}: ${statusText}`);
    this.name = "ConnectRequestError";
  }
}

/** User account is locked, unconfirmed, or has insufficient role. */
export class AuthenticationError extends ConnectAPIError {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

/** Task finished with a non-zero exit code or error message. */
export class TaskError extends ConnectAPIError {
  constructor(
    public readonly taskId: string,
    public readonly errorMessage: string,
    public readonly code: number,
  ) {
    super(errorMessage);
    this.name = "TaskError";
  }
}

/** Deployed content URL returned a 5xx status. */
export class DeploymentValidationError extends ConnectAPIError {
  constructor(
    public readonly contentId: string,
    public readonly httpStatus: number,
  ) {
    super("deployed content does not seem to be running");
    this.name = "DeploymentValidationError";
  }
}

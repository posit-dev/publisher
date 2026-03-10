// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, it } from "vitest";
import {
  AuthenticationError,
  ConnectAPIError,
  ConnectRequestError,
  DeploymentValidationError,
  TaskError,
} from "./errors.js";

describe("ConnectAPIError", () => {
  it("is an instance of Error", () => {
    const err = new ConnectAPIError("base error");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ConnectAPIError");
    expect(err.message).toBe("base error");
  });
});

describe("ConnectRequestError", () => {
  it("extends ConnectAPIError", () => {
    const err = new ConnectRequestError(404, "Not Found", "page missing");
    expect(err).toBeInstanceOf(ConnectAPIError);
    expect(err).toBeInstanceOf(Error);
  });

  it("carries status, statusText, and body", () => {
    const err = new ConnectRequestError(500, "Internal Server Error", "oops");
    expect(err.status).toBe(500);
    expect(err.statusText).toBe("Internal Server Error");
    expect(err.body).toBe("oops");
    expect(err.name).toBe("ConnectRequestError");
    expect(err.message).toBe("HTTP 500: Internal Server Error");
  });
});

describe("AuthenticationError", () => {
  it("extends ConnectAPIError", () => {
    const err = new AuthenticationError("locked");
    expect(err).toBeInstanceOf(ConnectAPIError);
    expect(err).toBeInstanceOf(Error);
  });

  it("has the correct name and message", () => {
    const err = new AuthenticationError("account locked");
    expect(err.name).toBe("AuthenticationError");
    expect(err.message).toBe("account locked");
  });
});

describe("TaskError", () => {
  it("extends ConnectAPIError", () => {
    const err = new TaskError("task-1", "failed to build", 1);
    expect(err).toBeInstanceOf(ConnectAPIError);
    expect(err).toBeInstanceOf(Error);
  });

  it("carries taskId, errorMessage, and code", () => {
    const err = new TaskError("task-abc", "timeout", 137);
    expect(err.taskId).toBe("task-abc");
    expect(err.errorMessage).toBe("timeout");
    expect(err.code).toBe(137);
    expect(err.name).toBe("TaskError");
    expect(err.message).toBe("timeout");
  });
});

describe("DeploymentValidationError", () => {
  it("extends ConnectAPIError", () => {
    const err = new DeploymentValidationError("content-1", 502);
    expect(err).toBeInstanceOf(ConnectAPIError);
    expect(err).toBeInstanceOf(Error);
  });

  it("carries contentId and httpStatus", () => {
    const err = new DeploymentValidationError("content-xyz", 500);
    expect(err.contentId).toBe("content-xyz");
    expect(err.httpStatus).toBe(500);
    expect(err.name).toBe("DeploymentValidationError");
    expect(err.message).toBe("deployed content does not seem to be running");
  });
});

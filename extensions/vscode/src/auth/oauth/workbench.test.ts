// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGet = vi.fn();

vi.mock("./httpClient", () => ({
  createOAuthHttpClient: vi.fn(() => ({ get: mockGet })),
  OAUTH_TIMEOUT_MS: 30_000,
}));

vi.mock("src/logging", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("src/utils/errors", () => ({
  getMessageFromError: (e: unknown) => String(e),
}));

import {
  detectWorkbench,
  isWorkbenchRelayReachable,
  pollWorkbenchAuthCode,
  WorkbenchRelayError,
  workbenchRedirectUri,
  WORKBENCH_POLL_MS,
} from "./workbench";

const WORKBENCH = {
  externalServerUrl: "https://workbench.example.com",
  serverAddress: "http://localhost:8787",
};

beforeEach(() => {
  mockGet.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("detectWorkbench", () => {
  it("returns both URLs when Workbench sets them", () => {
    expect(
      detectWorkbench({
        RS_SERVER_URL: "https://workbench.example.com",
        RS_SERVER_ADDRESS: "http://localhost:8787",
      }),
    ).toEqual(WORKBENCH);
  });

  it("strips the query string and trailing slashes Workbench appends", () => {
    expect(
      detectWorkbench({
        RS_SERVER_URL: "https://workbench.example.com/?token=abc",
        RS_SERVER_ADDRESS: "http://localhost:8787/",
      }),
    ).toEqual(WORKBENCH);
  });

  it("returns undefined outside Workbench", () => {
    expect(detectWorkbench({})).toBeUndefined();
  });

  it("returns undefined when only one of the two URLs is set", () => {
    expect(
      detectWorkbench({ RS_SERVER_URL: "https://workbench.example.com" }),
    ).toBeUndefined();
    expect(
      detectWorkbench({ RS_SERVER_ADDRESS: "http://localhost:8787" }),
    ).toBeUndefined();
  });

  it("returns undefined for a non-HTTP(S) URL", () => {
    expect(
      detectWorkbench({
        RS_SERVER_URL: "workbench.example.com",
        RS_SERVER_ADDRESS: "http://localhost:8787",
      }),
    ).toBeUndefined();
  });
});

describe("workbenchRedirectUri", () => {
  it("targets Workbench's generic OAuth relay on the browser-reachable URL", () => {
    expect(workbenchRedirectUri(WORKBENCH)).toBe(
      "https://workbench.example.com/oauth_redirect_callback",
    );
  });
});

describe("isWorkbenchRelayReachable", () => {
  it.each([400, 404, 429, 503])(
    "treats a %i from the relay route as reachable",
    async (status) => {
      mockGet.mockResolvedValue({ status, data: "" });
      expect(await isWorkbenchRelayReachable(WORKBENCH, false)).toBe(true);
      expect(mockGet).toHaveBeenCalledWith(
        "http://localhost:8787/oauth_code?state=posit-publisher-probe",
      );
    },
  );

  it("is unreachable when the route is absent or proxied away", async () => {
    mockGet.mockResolvedValue({ status: 200, data: "<html>login</html>" });
    expect(await isWorkbenchRelayReachable(WORKBENCH, false)).toBe(false);
  });

  it("is unreachable on a connection failure", async () => {
    mockGet.mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await isWorkbenchRelayReachable(WORKBENCH, false)).toBe(false);
  });
});

describe("pollWorkbenchAuthCode", () => {
  it("polls the host-reachable address until the code arrives", async () => {
    vi.useFakeTimers();
    try {
      mockGet
        .mockResolvedValueOnce({ status: 404, data: "" })
        .mockResolvedValueOnce({ status: 200, data: { code: "auth-code" } });

      const promise = pollWorkbenchAuthCode(WORKBENCH, "state-123", false);
      await vi.advanceTimersByTimeAsync(WORKBENCH_POLL_MS * 2 + 100);

      expect(await promise).toBe("auth-code");
      expect(mockGet).toHaveBeenCalledWith(
        "http://localhost:8787/oauth_code?state=state-123",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps polling through the load-shedding statuses", async () => {
    vi.useFakeTimers();
    try {
      mockGet
        .mockResolvedValueOnce({ status: 429, data: "" })
        .mockResolvedValueOnce({ status: 503, data: "" })
        .mockResolvedValueOnce({ status: 200, data: { code: "auth-code" } });

      const promise = pollWorkbenchAuthCode(WORKBENCH, "state-123", false);
      await vi.advanceTimersByTimeAsync(WORKBENCH_POLL_MS * 3 + 100);

      expect(await promise).toBe("auth-code");
    } finally {
      vi.useRealTimers();
    }
  });

  it("throws when the relay reports the request was denied", async () => {
    vi.useFakeTimers();
    try {
      mockGet.mockResolvedValue({ status: 403, data: "" });

      const promise = pollWorkbenchAuthCode(WORKBENCH, "state-123", false);
      const assertion = expect(promise).rejects.toMatchObject({
        message: "Authorization was denied.",
        terminal: true,
      });
      await vi.advanceTimersByTimeAsync(WORKBENCH_POLL_MS + 100);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("throws on an unexpected status", async () => {
    vi.useFakeTimers();
    try {
      mockGet.mockResolvedValue({ status: 500, data: "" });

      const promise = pollWorkbenchAuthCode(WORKBENCH, "state-123", false);
      const assertion = expect(promise).rejects.toMatchObject({
        message:
          "Posit Workbench returned an unexpected status (500) while waiting for authorization.",
        terminal: false,
      });
      await vi.advanceTimersByTimeAsync(WORKBENCH_POLL_MS + 100);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a polling connection failure as a non-terminal relay error", async () => {
    vi.useFakeTimers();
    try {
      mockGet.mockRejectedValue(new Error("ECONNRESET"));

      const promise = pollWorkbenchAuthCode(WORKBENCH, "state-123", false);
      const assertion = expect(promise).rejects.toMatchObject({
        name: "WorkbenchRelayError",
        terminal: false,
        message:
          "Posit Workbench became unreachable while waiting for authorization: Error: ECONNRESET",
      } satisfies Partial<WorkbenchRelayError>);
      await vi.advanceTimersByTimeAsync(WORKBENCH_POLL_MS + 100);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("throws when the deadline passes without a code", async () => {
    vi.useFakeTimers();
    try {
      mockGet.mockResolvedValue({ status: 404, data: "" });

      const promise = pollWorkbenchAuthCode(
        WORKBENCH,
        "state-123",
        false,
        WORKBENCH_POLL_MS * 2,
      );
      const assertion = expect(promise).rejects.toMatchObject({
        message: "Timed out waiting for authorization in your browser.",
        terminal: true,
      });
      await vi.advanceTimersByTimeAsync(WORKBENCH_POLL_MS * 3);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});

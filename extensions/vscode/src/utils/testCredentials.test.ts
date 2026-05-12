// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { testServerURL, testAuthentication } from "./testCredentials";
import { ServerType } from "src/api/types/contentRecords";
import { ConnectAPIError } from "@posit-dev/connect-api";

// ---------------------------------------------------------------------------
// Mock ConnectAPI
// ---------------------------------------------------------------------------

const { mockTestAuthentication } = vi.hoisted(() => ({
  mockTestAuthentication: vi.fn(),
}));

vi.mock("@posit-dev/connect-api", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@posit-dev/connect-api")>();
  return {
    ...actual,
    ConnectAPI: vi.fn(function () {
      return { testAuthentication: mockTestAuthentication };
    }),
  };
});

import { ConnectAPI } from "@posit-dev/connect-api";

const mockUser = {
  id: "user-guid-123",
  username: "publisher1",
  first_name: "Test",
  last_name: "User",
  email: "test@example.com",
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// testServerURL
// ---------------------------------------------------------------------------

describe("testServerURL", () => {
  test("reachable server — returns serverType, discovered URL, no error", async () => {
    mockTestAuthentication.mockRejectedValue(
      new ConnectAPIError("HTTP 401", 401),
    );

    const result = await testServerURL({
      url: "https://connect.example.com",
      insecure: false,
    });

    expect(result.user).toBeNull();
    expect(result.url).toBe("https://connect.example.com");
    expect(result.serverType).toBe(ServerType.CONNECT);
    expect(result.error).toBeNull();
  });

  test("URL discovery — extra path/fragment trimmed", async () => {
    mockTestAuthentication
      .mockRejectedValueOnce(new Error("nope1"))
      .mockRejectedValueOnce(new ConnectAPIError("HTTP 401", 401));

    const result = await testServerURL({
      url: "https://connect.localtest.me/rsc/dev-password/connect/#/apps/guid/access",
      insecure: false,
    });

    expect(result.url).toBe("https://connect.localtest.me/rsc/dev-password");
    expect(result.error).toBeNull();
  });

  test("Snowflake URL — skips Connect API probe, returns serverType", async () => {
    const result = await testServerURL({
      url: "https://example.snowflakecomputing.app",
      insecure: false,
    });

    expect(result.serverType).toBe(ServerType.SNOWFLAKE);
    expect(result.user).toBeNull();
    expect(result.url).toBe("https://example.snowflakecomputing.app");
    expect(result.error).toBeNull();
    expect(mockTestAuthentication).not.toHaveBeenCalled();
  });

  test("Snowflake privatelink URL — skips Connect API probe", async () => {
    const result = await testServerURL({
      url: "https://example.privatelink.snowflake.app",
      insecure: false,
    });

    expect(result.serverType).toBe(ServerType.SNOWFLAKE);
    expect(result.error).toBeNull();
    expect(mockTestAuthentication).not.toHaveBeenCalled();
  });

  test("Connect Cloud URL — detects server type", async () => {
    mockTestAuthentication.mockRejectedValue(
      new ConnectAPIError("HTTP 401", 401),
    );

    const result = await testServerURL({
      url: "https://connect.posit.cloud",
      insecure: false,
    });

    expect(result.serverType).toBe(ServerType.CONNECT_CLOUD);
  });

  test("invalid URL — returns error, null serverType", async () => {
    const result = await testServerURL({
      url: ":bad",
      insecure: false,
    });

    expect(result.user).toBeNull();
    expect(result.url).toBeNull();
    expect(result.serverType).toBeNull();
    expect(result.error).not.toBeNull();
  });

  test("unreachable server — returns error", async () => {
    mockTestAuthentication.mockRejectedValue(new Error("connection refused"));

    const result = await testServerURL({
      url: "https://connect.example.com",
      insecure: false,
    });

    expect(result.error).not.toBeNull();
    expect(result.error!.msg).toBe("Connection refused.");
  });

  test.each([
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "DEPTH_ZERO_SELF_SIGNED_CERT",
    "SELF_SIGNED_CERT_IN_CHAIN",
    "ERR_TLS_CERT_ALTNAME_INVALID",
    "CERT_HAS_EXPIRED",
    "unable to verify the first certificate",
  ])(
    "certificate error (%s) — returns errorCertificateVerification code",
    async (pattern) => {
      mockTestAuthentication.mockRejectedValue(new Error(pattern));

      const result = await testServerURL({
        url: "https://connect.example.com",
        insecure: false,
      });

      expect(result.error).not.toBeNull();
      expect(result.error!.code).toBe("errorCertificateVerification");
    },
  );

  test("network error — returns error with connectionFailed code", async () => {
    mockTestAuthentication.mockRejectedValue(
      new ConnectAPIError(
        "Unable to reach the server. Check your network connection, VPN, and server URL.",
      ),
    );

    const result = await testServerURL({
      url: "https://connect.example.com",
      insecure: false,
    });

    expect(result.user).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error!.msg).toContain("Unable to reach the server");
    expect(result.error!.code).toBe("connectionFailed");
  });

  test("passes rejectUnauthorized to ConnectAPI", async () => {
    mockTestAuthentication.mockRejectedValue(
      new ConnectAPIError("HTTP 401", 401),
    );

    await testServerURL({
      url: "https://connect.example.com",
      insecure: true,
    });

    const constructorCalls = (ConnectAPI as unknown as ReturnType<typeof vi.fn>)
      .mock.calls;
    expect(constructorCalls[0]![0].rejectUnauthorized).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// testAuthentication
// ---------------------------------------------------------------------------

describe("testAuthentication", () => {
  test("successful auth — returns user, discovered URL, serverType", async () => {
    mockTestAuthentication.mockResolvedValue({
      user: mockUser,
      error: null,
    });

    const result = await testAuthentication({
      url: "https://connect.example.com",
      apiKey: "0123456789abcdef0123456789abcdef",
      insecure: false,
    });

    expect(result.user).toEqual(mockUser);
    expect(result.url).toBe("https://connect.example.com");
    expect(result.serverType).toBe(ServerType.CONNECT);
    expect(result.error).toBeNull();
  });

  test("URL discovery — tries multiple paths", async () => {
    mockTestAuthentication
      .mockRejectedValueOnce(new Error("nope1"))
      .mockRejectedValueOnce(new Error("nope2"))
      .mockResolvedValueOnce({ user: mockUser, error: null });

    const result = await testAuthentication({
      url: "https://connect.example.com/pass/fail/fail",
      apiKey: "0123456789abcdef0123456789abcdef",
      insecure: false,
    });

    expect(result.user).toEqual(mockUser);
    expect(result.url).toBe("https://connect.example.com/pass");
    expect(result.error).toBeNull();

    const constructorCalls = (ConnectAPI as unknown as ReturnType<typeof vi.fn>)
      .mock.calls;
    expect(constructorCalls[0]![0].url).toBe(
      "https://connect.example.com/pass/fail/fail",
    );
    expect(constructorCalls[1]![0].url).toBe(
      "https://connect.example.com/pass/fail",
    );
    expect(constructorCalls[2]![0].url).toBe(
      "https://connect.example.com/pass",
    );
  });

  test("bad API key — returns error with normalized message", async () => {
    mockTestAuthentication.mockRejectedValue(
      new Error("test error from TestAuthentication"),
    );

    const result = await testAuthentication({
      url: "https://connect.example.com",
      apiKey: "invalid",
      insecure: false,
    });

    expect(result.user).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error!.msg).toBe("Test error from TestAuthentication.");
    expect(result.error!.code).toBe("unknown");
  });

  test("Snowflake + apiKey + snowflakeToken — tests auth through proxy", async () => {
    mockTestAuthentication.mockResolvedValue({
      user: mockUser,
      error: null,
    });

    const result = await testAuthentication({
      url: "https://example.snowflakecomputing.app",
      apiKey: "0123456789abcdef0123456789abcdef",
      snowflakeToken: "snowflake-session-token",
      insecure: false,
    });

    expect(result.user).toEqual(mockUser);
    expect(result.serverType).toBe(ServerType.SNOWFLAKE);
    expect(result.error).toBeNull();

    const constructorCalls = (ConnectAPI as unknown as ReturnType<typeof vi.fn>)
      .mock.calls;
    expect(constructorCalls[0]![0].snowflakeToken).toBe(
      "snowflake-session-token",
    );
    expect(constructorCalls[0]![0].apiKey).toBe(
      "0123456789abcdef0123456789abcdef",
    );
  });

  test("passes rejectUnauthorized to ConnectAPI", async () => {
    mockTestAuthentication.mockResolvedValue({
      user: mockUser,
      error: null,
    });

    await testAuthentication({
      url: "https://connect.example.com",
      apiKey: "key",
      insecure: true,
    });

    const constructorCalls = (ConnectAPI as unknown as ReturnType<typeof vi.fn>)
      .mock.calls;
    expect(constructorCalls[0]![0].rejectUnauthorized).toBe(false);
  });

  test("invalid URL — returns error, null serverType", async () => {
    const result = await testAuthentication({
      url: ":bad",
      apiKey: "key",
      insecure: false,
    });

    expect(result.user).toBeNull();
    expect(result.url).toBeNull();
    expect(result.serverType).toBeNull();
    expect(result.error).not.toBeNull();
  });

  test("error message already ending with period is not double-punctuated", async () => {
    mockTestAuthentication.mockRejectedValue(new Error("Something failed."));

    const result = await testAuthentication({
      url: "https://connect.example.com",
      apiKey: "key",
      insecure: false,
    });

    expect(result.error).not.toBeNull();
    expect(result.error!.msg).toBe("Something failed.");
  });
});

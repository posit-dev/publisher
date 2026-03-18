// Copyright (C) 2025 by Posit Software, PBC.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { testCredentials } from "./testCredentials";
import { ServerType } from "src/api/types/contentRecords";

// ---------------------------------------------------------------------------
// Mock ConnectAPI
// ---------------------------------------------------------------------------

const { mockTestAuthentication } = vi.hoisted(() => ({
  mockTestAuthentication: vi.fn(),
}));

vi.mock("@posit-dev/connect-api", () => ({
  ConnectAPI: vi.fn(function () {
    return { testAuthentication: mockTestAuthentication };
  }),
}));

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
// Tests
// ---------------------------------------------------------------------------

describe("testCredentials", () => {
  test("successful auth — returns user, discovered URL, serverType, no error", async () => {
    mockTestAuthentication.mockResolvedValue({
      user: mockUser,
      error: null,
    });

    const result = await testCredentials({
      url: "https://connect.example.com",
      apiKey: "0123456789abcdef0123456789abcdef",
      insecure: false,
    });

    expect(result.user).toEqual(mockUser);
    expect(result.url).toBe("https://connect.example.com");
    expect(result.serverType).toBe(ServerType.CONNECT);
    expect(result.error).toBeNull();
  });

  test("URL discovery with Connect copied URL — extra path/fragment trimmed", async () => {
    // URL produces: base, /rsc, /rsc/dev-password, /rsc/dev-password/connect
    // Walking backwards: /rsc/dev-password/connect fails, /rsc/dev-password succeeds
    mockTestAuthentication
      .mockRejectedValueOnce(new Error("nope1"))
      .mockResolvedValueOnce({ user: mockUser, error: null });

    const result = await testCredentials({
      url: "https://connect.localtest.me/rsc/dev-password/connect/#/apps/guid/access",
      apiKey: "0123456789abcdef0123456789abcdef",
      insecure: false,
    });

    expect(result.user).toEqual(mockUser);
    expect(result.url).toBe("https://connect.localtest.me/rsc/dev-password");
    expect(result.error).toBeNull();
  });

  test("URL discovery with extra paths — multiple failures before success", async () => {
    // fail /pass/fail/fail, fail /pass/fail, succeed /pass
    mockTestAuthentication
      .mockRejectedValueOnce(new Error("nope1"))
      .mockRejectedValueOnce(new Error("nope2"))
      .mockResolvedValueOnce({ user: mockUser, error: null });

    const result = await testCredentials({
      url: "https://connect.example.com/pass/fail/fail",
      apiKey: "0123456789abcdef0123456789abcdef",
      insecure: false,
    });

    expect(result.user).toEqual(mockUser);
    expect(result.url).toBe("https://connect.example.com/pass");
    expect(result.error).toBeNull();

    // ConnectAPI should have been constructed 3 times with the right URLs
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

  test("no API key — returns serverType, no user", async () => {
    mockTestAuthentication.mockResolvedValue({
      user: null,
      error: null,
    });

    const result = await testCredentials({
      url: "https://connect.example.com",
      insecure: false,
    });

    expect(result.user).toBeNull();
    expect(result.serverType).toBe(ServerType.CONNECT);
    expect(result.error).toBeNull();
  });

  test("bad API key — returns error with normalized message", async () => {
    mockTestAuthentication.mockRejectedValue(
      new Error("test error from TestAuthentication"),
    );

    const result = await testCredentials({
      url: "https://connect.example.com",
      apiKey: "invalid",
      insecure: false,
    });

    expect(result.user).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error!.msg).toBe("Test error from TestAuthentication.");
    expect(result.error!.code).toBe("unknown");
    expect(result.url).toBe("https://connect.example.com");
    expect(result.serverType).toBe(ServerType.CONNECT);
  });

  test("certificate error — returns errorCertificateVerification code", async () => {
    mockTestAuthentication.mockRejectedValue(
      new Error("UNABLE_TO_VERIFY_LEAF_SIGNATURE"),
    );

    const result = await testCredentials({
      url: "https://connect.example.com",
      apiKey: "somekey",
      insecure: false,
    });

    expect(result.user).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error!.code).toBe("errorCertificateVerification");
  });

  test("invalid URL — returns error, null serverType", async () => {
    const result = await testCredentials({
      url: ":bad",
      insecure: false,
    });

    expect(result.user).toBeNull();
    expect(result.url).toBeNull();
    expect(result.serverType).toBeNull();
    expect(result.error).not.toBeNull();
  });

  test("passes insecure and timeout to ConnectAPI", async () => {
    mockTestAuthentication.mockResolvedValue({
      user: mockUser,
      error: null,
    });

    await testCredentials({
      url: "https://connect.example.com",
      apiKey: "key",
      insecure: true,
      timeout: 60,
    });

    const constructorCalls = (ConnectAPI as unknown as ReturnType<typeof vi.fn>)
      .mock.calls;
    expect(constructorCalls[0]![0].insecure).toBe(true);
    expect(constructorCalls[0]![0].timeout).toBe(60000);
  });

  test("detects Connect Cloud server type", async () => {
    mockTestAuthentication.mockResolvedValue({
      user: mockUser,
      error: null,
    });

    const result = await testCredentials({
      url: "https://connect.posit.cloud",
      apiKey: "key",
      insecure: false,
    });

    expect(result.serverType).toBe(ServerType.CONNECT_CLOUD);
  });

  test("detects Snowflake server type", async () => {
    mockTestAuthentication.mockResolvedValue({
      user: mockUser,
      error: null,
    });

    const result = await testCredentials({
      url: "https://example.snowflakecomputing.app",
      apiKey: "key",
      insecure: false,
    });

    expect(result.serverType).toBe(ServerType.SNOWFLAKE);
  });
});

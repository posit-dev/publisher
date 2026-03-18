// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, test } from "vitest";
import { ServerType } from "src/api/types/contentRecords";
import {
  serverTypeFromURL,
  normalizeServerURL,
  isConnectLike,
} from "./serverUrl";

describe("serverTypeFromURL", () => {
  test("returns CONNECT_CLOUD for connect.posit.cloud", () => {
    expect(serverTypeFromURL("https://connect.posit.cloud")).toBe(
      ServerType.CONNECT_CLOUD,
    );
  });

  test("returns CONNECT_CLOUD for subdomain of connect.posit.cloud", () => {
    expect(serverTypeFromURL("https://staging.connect.posit.cloud")).toBe(
      ServerType.CONNECT_CLOUD,
    );
  });

  test("returns SNOWFLAKE for snowflakecomputing.app", () => {
    expect(serverTypeFromURL("https://my-org.snowflakecomputing.app")).toBe(
      ServerType.SNOWFLAKE,
    );
  });

  test("returns SNOWFLAKE for privatelink.snowflake.app", () => {
    expect(serverTypeFromURL("https://my-org.privatelink.snowflake.app")).toBe(
      ServerType.SNOWFLAKE,
    );
  });

  test("returns CONNECT for plain connect server", () => {
    expect(serverTypeFromURL("https://connect.example.com")).toBe(
      ServerType.CONNECT,
    );
  });

  test("returns CONNECT for localhost", () => {
    expect(serverTypeFromURL("http://localhost:3939")).toBe(ServerType.CONNECT);
  });
});

describe("normalizeServerURL", () => {
  test("removes trailing slash", () => {
    expect(normalizeServerURL("https://example.com/connect/")).toBe(
      "https://example.com/connect",
    );
  });

  test("removes root trailing slash", () => {
    expect(normalizeServerURL("https://example.com/")).toBe(
      "https://example.com",
    );
  });

  test("resolves dot segments", () => {
    expect(normalizeServerURL("https://example.com/a/../b")).toBe(
      "https://example.com/b",
    );
  });

  test("collapses duplicate slashes", () => {
    expect(normalizeServerURL("https://example.com//connect///path")).toBe(
      "https://example.com/connect/path",
    );
  });

  test("preserves port", () => {
    expect(normalizeServerURL("https://example.com:8443/connect")).toBe(
      "https://example.com:8443/connect",
    );
  });

  test("handles URL with no path", () => {
    expect(normalizeServerURL("https://example.com")).toBe(
      "https://example.com",
    );
  });
});

describe("isConnectLike", () => {
  test("returns true for CONNECT", () => {
    expect(isConnectLike(ServerType.CONNECT)).toBe(true);
  });

  test("returns true for SNOWFLAKE", () => {
    expect(isConnectLike(ServerType.SNOWFLAKE)).toBe(true);
  });

  test("returns false for CONNECT_CLOUD", () => {
    expect(isConnectLike(ServerType.CONNECT_CLOUD)).toBe(false);
  });
});

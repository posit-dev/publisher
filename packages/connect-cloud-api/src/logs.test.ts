// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloudEnvironment, type LogLine, type LogsEventData } from "./types.js";

// Track the latest EventSource instance for testing
interface MockInstance {
  url: string;
  options: { fetch?: unknown } | undefined;
  readyState: number;
  close: ReturnType<typeof vi.fn>;
  triggerEvent: (
    event: string,
    data?: { data?: string; message?: string },
  ) => void;
}

let latestMockInstance: MockInstance | null = null;

// Mock the eventsource module
vi.mock("eventsource", () => {
  class MockEventSource {
    static CLOSED = 2;
    readyState = 0; // CONNECTING
    close = vi.fn();
    url: string;
    options: { fetch?: unknown } | undefined;
    private eventHandlers = new Map<
      string,
      Array<(event: { data?: string; message?: string }) => void>
    >();

    constructor(url: string, options?: { fetch?: unknown }) {
      this.url = url;
      this.options = options;
      latestMockInstance = this as unknown as MockInstance;
    }

    addEventListener(
      event: string,
      handler: (event: { data?: string; message?: string }) => void,
    ) {
      const handlers = this.eventHandlers.get(event) || [];
      handlers.push(handler);
      this.eventHandlers.set(event, handlers);
    }

    triggerEvent(event: string, data?: { data?: string; message?: string }) {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        for (const handler of handlers) {
          handler(data || {});
        }
      }
    }
  }

  return { EventSource: MockEventSource };
});

// Import after mocking
import { watchCloudLogs } from "./logs.js";

// Helper function to get the latest instance
function getInstance(): MockInstance {
  if (!latestMockInstance) {
    throw new Error("No EventSource instance created yet");
  }
  return latestMockInstance;
}

describe("watchCloudLogs", () => {
  let dateNowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock Date.now() for deterministic timestamps
    dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    latestMockInstance = null;
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe("URL construction", () => {
    it("constructs correct URL for development environment", async () => {
      const onLog = vi.fn();
      const promise = watchCloudLogs({
        environment: CloudEnvironment.Development,
        logChannel: "test-channel-123",
        authToken: "test-token",
        onLog,
      });

      const instance = getInstance();

      // Close immediately to resolve the promise
      instance.readyState = 2; // CLOSED
      instance.triggerEvent("error");

      await promise;

      const nowNanos = 1_700_000_000_000 * 1_000_000;
      const lookbackNanos = 60 * 1_000_000_000;
      const sortKeyGt = nowNanos - lookbackNanos;

      expect(instance.url).toBe(
        `https://logs.dev.connect.posit.cloud/v1/logs/test-channel-123/stream?sort_key__gt=${sortKeyGt}`,
      );
    });

    it("constructs correct URL for staging environment", async () => {
      const onLog = vi.fn();
      const promise = watchCloudLogs({
        environment: CloudEnvironment.Staging,
        logChannel: "staging-channel",
        authToken: "test-token",
        onLog,
      });

      const instance = getInstance();
      instance.readyState = 2;
      instance.triggerEvent("error");

      await promise;

      const nowNanos = 1_700_000_000_000 * 1_000_000;
      const lookbackNanos = 60 * 1_000_000_000;
      const sortKeyGt = nowNanos - lookbackNanos;

      expect(instance.url).toBe(
        `https://logs.staging.connect.posit.cloud/v1/logs/staging-channel/stream?sort_key__gt=${sortKeyGt}`,
      );
    });

    it("constructs correct URL for production environment", async () => {
      const onLog = vi.fn();
      const promise = watchCloudLogs({
        environment: CloudEnvironment.Production,
        logChannel: "prod-channel",
        authToken: "test-token",
        onLog,
      });

      const instance = getInstance();
      instance.readyState = 2;
      instance.triggerEvent("error");

      await promise;

      const nowNanos = 1_700_000_000_000 * 1_000_000;
      const lookbackNanos = 60 * 1_000_000_000;
      const sortKeyGt = nowNanos - lookbackNanos;

      expect(instance.url).toBe(
        `https://logs.connect.posit.cloud/v1/logs/prod-channel/stream?sort_key__gt=${sortKeyGt}`,
      );
    });

    it("encodes logChannel in the URL path", async () => {
      const onLog = vi.fn();
      const promise = watchCloudLogs({
        environment: CloudEnvironment.Production,
        logChannel: "channel/with special?chars#here",
        authToken: "test-token",
        onLog,
      });

      const instance = getInstance();
      instance.readyState = 2;
      instance.triggerEvent("error");

      await promise;

      const nowNanos = 1_700_000_000_000 * 1_000_000;
      const lookbackNanos = 60 * 1_000_000_000;
      const sortKeyGt = nowNanos - lookbackNanos;

      expect(instance.url).toBe(
        `https://logs.connect.posit.cloud/v1/logs/${encodeURIComponent("channel/with special?chars#here")}/stream?sort_key__gt=${sortKeyGt}`,
      );
    });

    it("includes correct 60-second lookback in sort_key__gt parameter", async () => {
      const onLog = vi.fn();
      const promise = watchCloudLogs({
        environment: CloudEnvironment.Production,
        logChannel: "test-channel",
        authToken: "test-token",
        onLog,
      });

      const instance = getInstance();
      instance.readyState = 2;
      instance.triggerEvent("error");

      await promise;

      // Calculate expected values
      const nowNanos = 1_700_000_000_000 * 1_000_000;
      const lookbackNanos = 60 * 1_000_000_000; // 60 seconds
      const expectedSortKeyGt = nowNanos - lookbackNanos;

      expect(instance.url).toContain(`sort_key__gt=${expectedSortKeyGt}`);
    });
  });

  describe("Authorization header", () => {
    it("passes Authorization header to custom fetch", async () => {
      const onLog = vi.fn();
      const promise = watchCloudLogs({
        environment: CloudEnvironment.Production,
        logChannel: "test-channel",
        authToken: "my-secret-token",
        onLog,
      });

      const instance = getInstance();

      // Get the options passed to EventSource
      expect(instance.options).toBeDefined();
      expect(instance.options?.fetch).toBeDefined();

      // Call the custom fetch function to verify Authorization header is injected
      const customFetch = instance.options?.fetch as (
        input: string,
        init?: { headers?: Record<string, string> },
      ) => Promise<Response>;

      const mockFetch = vi.fn().mockResolvedValue(new Response());
      global.fetch = mockFetch;

      await customFetch("https://example.com", {
        headers: { "X-Custom": "value" },
      });

      expect(mockFetch).toHaveBeenCalledWith("https://example.com", {
        headers: {
          "X-Custom": "value",
          Authorization: "Bearer my-secret-token",
        },
      });

      // Close the stream
      instance.readyState = 2;
      instance.triggerEvent("error");

      await promise;
    });

    it("preserves existing headers when adding Authorization", async () => {
      const onLog = vi.fn();
      const promise = watchCloudLogs({
        environment: CloudEnvironment.Production,
        logChannel: "test-channel",
        authToken: "token-123",
        onLog,
      });

      const instance = getInstance();
      const customFetch = instance.options?.fetch as (
        input: string,
        init?: { headers?: Record<string, string> },
      ) => Promise<Response>;

      const mockFetch = vi.fn().mockResolvedValue(new Response());
      global.fetch = mockFetch;

      await customFetch("https://example.com", {
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": "abc",
        },
      });

      expect(mockFetch).toHaveBeenCalledWith("https://example.com", {
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": "abc",
          Authorization: "Bearer token-123",
        },
      });

      instance.readyState = 2;
      instance.triggerEvent("error");

      await promise;
    });
  });

  describe("Log parsing", () => {
    it("parses single log entry and calls onLog", async () => {
      const onLog = vi.fn();
      const promise = watchCloudLogs({
        environment: CloudEnvironment.Production,
        logChannel: "test-channel",
        authToken: "test-token",
        onLog,
      });

      const instance = getInstance();

      const eventData: LogsEventData = {
        data: [
          {
            timestamp: 1700000000000,
            sort_key: 1700000000000,
            message: "Test log message",
            type: "build",
            level: "info",
          },
        ],
      };

      instance.triggerEvent("message", { data: JSON.stringify(eventData) });

      expect(onLog).toHaveBeenCalledTimes(1);
      expect(onLog).toHaveBeenCalledWith({
        level: "info",
        message: "Test log message",
      });

      // Close the stream
      instance.readyState = 2;
      instance.triggerEvent("error");

      await promise;
    });

    it("parses multiple log entries from single event", async () => {
      const onLog = vi.fn();
      const promise = watchCloudLogs({
        environment: CloudEnvironment.Production,
        logChannel: "test-channel",
        authToken: "test-token",
        onLog,
      });

      const instance = getInstance();

      const eventData: LogsEventData = {
        data: [
          {
            timestamp: 1700000000000,
            sort_key: 1700000000000,
            message: "First message",
            type: "build",
            level: "info",
          },
          {
            timestamp: 1700000001000,
            sort_key: 1700000001000,
            message: "Second message",
            type: "runtime",
            level: "debug",
          },
          {
            timestamp: 1700000002000,
            sort_key: 1700000002000,
            message: "Third message",
            type: "build",
            level: "error",
          },
        ],
      };

      instance.triggerEvent("message", { data: JSON.stringify(eventData) });

      expect(onLog).toHaveBeenCalledTimes(3);
      expect(onLog).toHaveBeenNthCalledWith(1, {
        level: "info",
        message: "First message",
      });
      expect(onLog).toHaveBeenNthCalledWith(2, {
        level: "debug",
        message: "Second message",
      });
      expect(onLog).toHaveBeenNthCalledWith(3, {
        level: "error",
        message: "Third message",
      });

      // Close the stream
      instance.readyState = 2;
      instance.triggerEvent("error");

      await promise;
    });

    it("extracts only level and message from log entries", async () => {
      const onLog = vi.fn();
      const promise = watchCloudLogs({
        environment: CloudEnvironment.Production,
        logChannel: "test-channel",
        authToken: "test-token",
        onLog,
      });

      const instance = getInstance();

      const eventData: LogsEventData = {
        data: [
          {
            timestamp: 1700000000000,
            sort_key: 1700000000000,
            message: "Log with extra fields",
            type: "runtime",
            level: "info",
          },
        ],
      };

      instance.triggerEvent("message", { data: JSON.stringify(eventData) });

      const expectedLogLine: LogLine = {
        level: "info",
        message: "Log with extra fields",
      };

      expect(onLog).toHaveBeenCalledTimes(1);
      expect(onLog).toHaveBeenCalledWith(expectedLogLine);

      // Verify no extra properties
      const actualCall = onLog.mock.calls[0][0];
      expect(Object.keys(actualCall)).toEqual(["level", "message"]);

      // Close the stream
      instance.readyState = 2;
      instance.triggerEvent("error");

      await promise;
    });
  });

  describe("Multiple events", () => {
    it("handles multiple SSE message events", async () => {
      const onLog = vi.fn();
      const promise = watchCloudLogs({
        environment: CloudEnvironment.Production,
        logChannel: "test-channel",
        authToken: "test-token",
        onLog,
      });

      const instance = getInstance();

      // First event
      const event1: LogsEventData = {
        data: [
          {
            timestamp: 1700000000000,
            sort_key: 1700000000000,
            message: "Event 1 message",
            type: "build",
            level: "info",
          },
        ],
      };
      instance.triggerEvent("message", { data: JSON.stringify(event1) });

      // Second event
      const event2: LogsEventData = {
        data: [
          {
            timestamp: 1700000001000,
            sort_key: 1700000001000,
            message: "Event 2 message",
            type: "runtime",
            level: "debug",
          },
        ],
      };
      instance.triggerEvent("message", { data: JSON.stringify(event2) });

      // Third event with multiple entries
      const event3: LogsEventData = {
        data: [
          {
            timestamp: 1700000002000,
            sort_key: 1700000002000,
            message: "Event 3 message 1",
            type: "build",
            level: "error",
          },
          {
            timestamp: 1700000003000,
            sort_key: 1700000003000,
            message: "Event 3 message 2",
            type: "build",
            level: "info",
          },
        ],
      };
      instance.triggerEvent("message", { data: JSON.stringify(event3) });

      expect(onLog).toHaveBeenCalledTimes(4);
      expect(onLog).toHaveBeenNthCalledWith(1, {
        level: "info",
        message: "Event 1 message",
      });
      expect(onLog).toHaveBeenNthCalledWith(2, {
        level: "debug",
        message: "Event 2 message",
      });
      expect(onLog).toHaveBeenNthCalledWith(3, {
        level: "error",
        message: "Event 3 message 1",
      });
      expect(onLog).toHaveBeenNthCalledWith(4, {
        level: "info",
        message: "Event 3 message 2",
      });

      // Close the stream
      instance.readyState = 2;
      instance.triggerEvent("error");

      await promise;
    });
  });

  describe("AbortSignal", () => {
    it("resolves immediately without opening EventSource when signal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort();
      const onLog = vi.fn();

      await expect(
        watchCloudLogs({
          environment: CloudEnvironment.Production,
          logChannel: "test-channel",
          authToken: "test-token",
          onLog,
          signal: controller.signal,
        }),
      ).resolves.toBeUndefined();

      // No EventSource should have been created
      expect(latestMockInstance).toBeNull();
      expect(onLog).not.toHaveBeenCalled();
    });

    it("closes EventSource and resolves when signal is aborted", async () => {
      const controller = new AbortController();
      const onLog = vi.fn();

      const promise = watchCloudLogs({
        environment: CloudEnvironment.Production,
        logChannel: "test-channel",
        authToken: "test-token",
        onLog,
        signal: controller.signal,
      });

      const instance = getInstance();

      // Abort the signal
      controller.abort();

      // Promise should resolve (not reject)
      await expect(promise).resolves.toBeUndefined();

      // close() should have been called
      expect(instance.close).toHaveBeenCalled();
    });

    it("continues to work without signal", async () => {
      const onLog = vi.fn();

      const promise = watchCloudLogs({
        environment: CloudEnvironment.Production,
        logChannel: "test-channel",
        authToken: "test-token",
        onLog,
        // No signal provided
      });

      const instance = getInstance();

      // Send a log event
      const eventData: LogsEventData = {
        data: [
          {
            timestamp: 1700000000000,
            sort_key: 1700000000000,
            message: "No signal test",
            type: "build",
            level: "info",
          },
        ],
      };
      instance.triggerEvent("message", { data: JSON.stringify(eventData) });

      expect(onLog).toHaveBeenCalledWith({
        level: "info",
        message: "No signal test",
      });

      // Close the stream normally
      instance.readyState = 2;
      instance.triggerEvent("error");

      await promise;
    });
  });

  describe("Server-initiated closure", () => {
    it("resolves when server closes stream (readyState === CLOSED)", async () => {
      const onLog = vi.fn();

      const promise = watchCloudLogs({
        environment: CloudEnvironment.Production,
        logChannel: "test-channel",
        authToken: "test-token",
        onLog,
      });

      const instance = getInstance();

      // Simulate server closing the stream
      instance.readyState = 2; // CLOSED
      instance.triggerEvent("error");

      // Should resolve, not reject
      await expect(promise).resolves.toBeUndefined();
    });

    it("closes EventSource on server-initiated closure", async () => {
      const onLog = vi.fn();

      const promise = watchCloudLogs({
        environment: CloudEnvironment.Production,
        logChannel: "test-channel",
        authToken: "test-token",
        onLog,
      });

      const instance = getInstance();

      instance.readyState = 2;
      instance.triggerEvent("error");

      await promise;

      expect(instance.close).toHaveBeenCalled();
    });
  });

  describe("Connection error", () => {
    it("rejects when connection error occurs (readyState !== CLOSED)", async () => {
      const onLog = vi.fn();

      const promise = watchCloudLogs({
        environment: CloudEnvironment.Production,
        logChannel: "test-channel",
        authToken: "test-token",
        onLog,
      });

      const instance = getInstance();

      // Simulate connection error (readyState is not CLOSED)
      instance.readyState = 0; // CONNECTING
      instance.triggerEvent("error", { message: "Network error" });

      await expect(promise).rejects.toThrow(
        "Cloud logs stream error: Network error",
      );
    });

    it("rejects with default message when error has no message", async () => {
      const onLog = vi.fn();

      const promise = watchCloudLogs({
        environment: CloudEnvironment.Production,
        logChannel: "test-channel",
        authToken: "test-token",
        onLog,
      });

      const instance = getInstance();

      instance.readyState = 1; // OPEN
      instance.triggerEvent("error", {});

      await expect(promise).rejects.toThrow(
        "Cloud logs stream error: unknown error",
      );
    });

    it("closes EventSource on connection error", async () => {
      const onLog = vi.fn();

      const promise = watchCloudLogs({
        environment: CloudEnvironment.Production,
        logChannel: "test-channel",
        authToken: "test-token",
        onLog,
      });

      const instance = getInstance();

      instance.readyState = 0;
      instance.triggerEvent("error");

      await expect(promise).rejects.toThrow();

      expect(instance.close).toHaveBeenCalled();
    });
  });

  describe("Malformed JSON", () => {
    it("skips events with invalid JSON", async () => {
      const onLog = vi.fn();

      const promise = watchCloudLogs({
        environment: CloudEnvironment.Production,
        logChannel: "test-channel",
        authToken: "test-token",
        onLog,
      });

      const instance = getInstance();

      // Send malformed JSON
      instance.triggerEvent("message", { data: "invalid json{" });

      // onLog should not have been called
      expect(onLog).not.toHaveBeenCalled();

      // Send valid event after malformed one
      const validEvent: LogsEventData = {
        data: [
          {
            timestamp: 1700000000000,
            sort_key: 1700000000000,
            message: "Valid message",
            type: "build",
            level: "info",
          },
        ],
      };
      instance.triggerEvent("message", { data: JSON.stringify(validEvent) });

      // Now onLog should have been called once
      expect(onLog).toHaveBeenCalledTimes(1);
      expect(onLog).toHaveBeenCalledWith({
        level: "info",
        message: "Valid message",
      });

      // Close the stream
      instance.readyState = 2;
      instance.triggerEvent("error");

      await promise;
    });

    it("does not reject promise on malformed JSON", async () => {
      const onLog = vi.fn();

      const promise = watchCloudLogs({
        environment: CloudEnvironment.Production,
        logChannel: "test-channel",
        authToken: "test-token",
        onLog,
      });

      const instance = getInstance();

      // Send malformed JSON
      instance.triggerEvent("message", { data: "}{invalid" });

      // Close the stream normally
      instance.readyState = 2;
      instance.triggerEvent("error");

      // Should resolve, not reject
      await expect(promise).resolves.toBeUndefined();
    });

    it("skips events with missing data property", async () => {
      const onLog = vi.fn();

      const promise = watchCloudLogs({
        environment: CloudEnvironment.Production,
        logChannel: "test-channel",
        authToken: "test-token",
        onLog,
      });

      const instance = getInstance();

      // Send JSON without data array
      instance.triggerEvent("message", {
        data: JSON.stringify({ invalid: "structure" }),
      });

      // This should cause an error when iterating over data.data
      // The try-catch should handle it silently
      expect(onLog).not.toHaveBeenCalled();

      // Close the stream
      instance.readyState = 2;
      instance.triggerEvent("error");

      await promise;
    });
  });
});

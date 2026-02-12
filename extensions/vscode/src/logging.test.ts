// Copyright (C) 2025 by Posit Software, PBC.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { logAgentOutput, logger } from "./logging";

// Mock vscode
vi.mock("vscode", () => ({
  window: {
    createOutputChannel: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      show: vi.fn(),
    })),
  },
}));

describe("logAgentOutput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("slog format parsing", () => {
    test("parses INFO level message", () => {
      logAgentOutput(
        'time=2024-01-15T10:30:00.000Z level=INFO msg="Starting server"',
      );
      expect(logger.info).toHaveBeenCalledWith("[agent] Starting server");
    });

    test("parses DEBUG level message", () => {
      logAgentOutput(
        'time=2024-01-15T10:30:00.000Z level=DEBUG msg="Debug message"',
      );
      expect(logger.debug).toHaveBeenCalledWith("[agent] Debug message");
    });

    test("parses WARN level message", () => {
      logAgentOutput(
        'time=2024-01-15T10:30:00.000Z level=WARN msg="Warning message"',
      );
      expect(logger.warn).toHaveBeenCalledWith("[agent] Warning message");
    });

    test("parses WARNING level message", () => {
      logAgentOutput(
        'time=2024-01-15T10:30:00.000Z level=WARNING msg="Warning message"',
      );
      expect(logger.warn).toHaveBeenCalledWith("[agent] Warning message");
    });

    test("parses ERROR level message", () => {
      logAgentOutput(
        'time=2024-01-15T10:30:00.000Z level=ERROR msg="Error message"',
      );
      expect(logger.error).toHaveBeenCalledWith("[agent] Error message");
    });

    test("handles lowercase level", () => {
      logAgentOutput(
        'time=2024-01-15T10:30:00.000Z level=info msg="Info message"',
      );
      expect(logger.info).toHaveBeenCalledWith("[agent] Info message");
    });

    test("defaults unknown level to info", () => {
      logAgentOutput(
        'time=2024-01-15T10:30:00.000Z level=TRACE msg="Trace message"',
      );
      expect(logger.info).toHaveBeenCalledWith("[agent] Trace message");
    });
  });

  describe("attribute parsing", () => {
    test("parses unquoted key=value attributes", () => {
      logAgentOutput(
        'time=2024-01-15T10:30:00.000Z level=INFO msg="Server started" port=8080 host=localhost',
      );
      expect(logger.info).toHaveBeenCalledWith(
        "[agent] Server started port=8080 host=localhost",
      );
    });

    test("parses quoted key=value attributes", () => {
      logAgentOutput(
        'time=2024-01-15T10:30:00.000Z level=INFO msg="User logged in" user="john doe" role="admin"',
      );
      expect(logger.info).toHaveBeenCalledWith(
        "[agent] User logged in user=john doe role=admin",
      );
    });

    test("parses mixed quoted and unquoted attributes", () => {
      logAgentOutput(
        'time=2024-01-15T10:30:00.000Z level=INFO msg="Request completed" status=200 path="/api/users"',
      );
      expect(logger.info).toHaveBeenCalledWith(
        "[agent] Request completed status=200 path=/api/users",
      );
    });

    test("handles message with no attributes", () => {
      logAgentOutput(
        'time=2024-01-15T10:30:00.000Z level=INFO msg="Simple message"',
      );
      expect(logger.info).toHaveBeenCalledWith("[agent] Simple message");
    });
  });

  describe("non-slog format handling", () => {
    test("logs non-slog lines as info with [agent] prefix", () => {
      logAgentOutput("This is a plain text message");
      expect(logger.info).toHaveBeenCalledWith(
        "[agent] This is a plain text message",
      );
    });

    test("logs panic output as info", () => {
      logAgentOutput("panic: runtime error: index out of range");
      expect(logger.info).toHaveBeenCalledWith(
        "[agent] panic: runtime error: index out of range",
      );
    });

    test("logs stack trace lines as info", () => {
      logAgentOutput("goroutine 1 [running]:");
      expect(logger.info).toHaveBeenCalledWith(
        "[agent] goroutine 1 [running]:",
      );
    });
  });

  describe("whitespace handling", () => {
    test("trims leading and trailing whitespace", () => {
      logAgentOutput(
        '  time=2024-01-15T10:30:00.000Z level=INFO msg="Trimmed message"  ',
      );
      expect(logger.info).toHaveBeenCalledWith("[agent] Trimmed message");
    });

    test("ignores empty lines", () => {
      logAgentOutput("");
      expect(logger.info).not.toHaveBeenCalled();
      expect(logger.debug).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    test("ignores whitespace-only lines", () => {
      logAgentOutput("   \t  \n  ");
      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    test("handles empty message - falls back to raw output", () => {
      logAgentOutput('time=2024-01-15T10:30:00.000Z level=INFO msg=""');
      // Empty message doesn't match the regex pattern (requires non-empty msg),
      // so it falls back to logging the raw line
      expect(logger.info).toHaveBeenCalledWith(
        '[agent] time=2024-01-15T10:30:00.000Z level=INFO msg=""',
      );
    });

    test("handles message with special characters", () => {
      logAgentOutput(
        'time=2024-01-15T10:30:00.000Z level=INFO msg="Path: /usr/local/bin"',
      );
      expect(logger.info).toHaveBeenCalledWith("[agent] Path: /usr/local/bin");
    });

    test("handles message with equals sign", () => {
      logAgentOutput(
        'time=2024-01-15T10:30:00.000Z level=INFO msg="Setting value=123"',
      );
      expect(logger.info).toHaveBeenCalledWith("[agent] Setting value=123");
    });

    test("handles attributes with empty quoted values", () => {
      logAgentOutput(
        'time=2024-01-15T10:30:00.000Z level=INFO msg="Test" empty=""',
      );
      expect(logger.info).toHaveBeenCalledWith("[agent] Test empty=");
    });
  });
});
